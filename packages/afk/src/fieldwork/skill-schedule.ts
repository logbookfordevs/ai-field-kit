import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import type { UpdateProgress } from "./skill-update.js";

export type ScheduleFrequency = "daily" | "weekly";
export interface ScheduleChoice { enabled: boolean; frequency: ScheduleFrequency; time: string; weekday: number }
export interface ScheduleResult { at: number; code?: number; updated?: number; cancelled?: boolean; phase: string; output: string }
export interface ScheduleRecord extends ScheduleChoice { since?: number; lastAttemptAt?: number; lastResult?: ScheduleResult }
export interface ScheduleState extends ScheduleRecord { scope: "Global"; nextRunAt?: number; running: boolean }

const defaults: ScheduleChoice = { enabled: false, frequency: "weekly", time: "09:00", weekday: 1 };
const OUTPUT_LIMIT = 20_000;

function clock(time: string): [number, number] {
  const [hours, minutes] = time.split(":").map(Number);
  return [hours!, minutes!];
}

export function validateChoice(value: Record<string, unknown>): ScheduleChoice {
  if (typeof value.enabled !== "boolean") throw new Error("Provide enabled as true or false.");
  if (value.frequency !== "daily" && value.frequency !== "weekly") throw new Error("Choose daily or weekly.");
  if (typeof value.time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time)) throw new Error("Provide time as HH:MM in 24-hour local time.");
  const weekday = value.weekday ?? defaults.weekday;
  if (!Number.isInteger(weekday) || (weekday as number) < 0 || (weekday as number) > 6) throw new Error("Provide weekday as 0 (Sunday) to 6 (Saturday).");
  return { enabled: value.enabled, frequency: value.frequency, time: value.time, weekday: weekday as number };
}

export function latestSlot(choice: ScheduleChoice, now: Date): Date {
  const [hours, minutes] = clock(choice.time);
  const slot = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
  if (choice.frequency === "weekly") slot.setDate(slot.getDate() - (slot.getDay() - choice.weekday + 7) % 7);
  if (slot > now) slot.setDate(slot.getDate() - (choice.frequency === "weekly" ? 7 : 1));
  return slot;
}

export function nextSlot(choice: ScheduleChoice, now: Date): Date {
  const slot = latestSlot(choice, now);
  slot.setDate(slot.getDate() + (choice.frequency === "weekly" ? 7 : 1));
  return slot;
}

// A slot is due once: it must follow both the last attempt and the moment this schedule was chosen,
// so a slot missed while AFK was closed runs on the next start, and editing the schedule never fires at once.
export function isDue(record: ScheduleRecord, now: Date): boolean {
  if (!record.enabled) return false;
  return latestSlot(record, now).getTime() > Math.max(record.since ?? 0, record.lastAttemptAt ?? 0);
}

export class SkillUpdateSchedule {
  readonly path: string;
  running = false;

  constructor(home: string) {
    this.path = join(home, ".afk/skill-update-schedule.json");
  }

  async read(): Promise<ScheduleRecord> {
    let saved: Partial<ScheduleRecord> = {};
    try { saved = JSON.parse(await readFile(this.path, "utf8")) as Partial<ScheduleRecord>; } catch { /* A missing or unreadable record means no schedule. */ }
    try { return { ...saved, ...validateChoice({ ...defaults, ...saved }) }; } catch { return { ...defaults }; }
  }

  async state(now = new Date()): Promise<ScheduleState> {
    const record = await this.read();
    return { ...record, scope: "Global", running: this.running, ...(record.enabled ? { nextRunAt: (isDue(record, now) ? now : nextSlot(record, now)).getTime() } : {}) };
  }

  async choose(value: Record<string, unknown> | ScheduleChoice, now = new Date()): Promise<ScheduleState> {
    const choice = validateChoice({ ...value }), record = await this.read();
    const unchanged = record.enabled === choice.enabled && record.frequency === choice.frequency && record.time === choice.time && record.weekday === choice.weekday;
    await this.write({ ...record, ...choice, ...(unchanged ? {} : { since: now.getTime() }) });
    return this.state(now);
  }

  async attempt(now: Date): Promise<void> {
    await this.write({ ...await this.read(), lastAttemptAt: now.getTime() });
  }

  async finish(result: UpdateProgress | Error, now: Date): Promise<void> {
    const lastResult: ScheduleResult = result instanceof Error
      ? { at: now.getTime(), code: 1, phase: "Update failed; review the details", output: result.message }
      : { at: now.getTime(), phase: result.phase, output: result.output.slice(-OUTPUT_LIMIT), ...(result.code === undefined ? {} : { code: result.code }), ...(result.updated === undefined ? {} : { updated: result.updated }), ...(result.cancelled ? { cancelled: true } : {}) };
    await this.write({ ...await this.read(), lastResult });
  }

  private async write(record: ScheduleRecord): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, this.path);
  }
}

export interface ScheduleRunner {
  update: () => Promise<UpdateProgress>;
  blocked: () => Promise<boolean>;
  now?: () => Date;
  interval?: number;
  onError?: (error: unknown) => void;
}

export function startSchedule(schedule: SkillUpdateSchedule, runner: ScheduleRunner): { tick: () => Promise<void>; stop: () => Promise<void> } {
  const now = runner.now ?? (() => new Date());
  let current: Promise<void> | undefined;
  let stopped = false;

  const check = async (): Promise<void> => {
    if (stopped || !isDue(await schedule.read(), now()) || await runner.blocked()) return;
    await schedule.attempt(now());
    schedule.running = true;
    try {
      const result = await runner.update().catch((error: unknown) => error instanceof Error ? error : new Error("Update failed."));
      await schedule.finish(result, now());
    } finally { schedule.running = false; }
  };

  const tick = (): Promise<void> => {
    current ??= check().catch(error => runner.onError?.(error)).finally(() => { current = undefined; });
    return current;
  };

  const timer = setInterval(() => void tick(), runner.interval ?? 60_000);
  timer.unref();
  const first = setTimeout(() => void tick(), 5_000);
  first.unref();

  return {
    tick,
    stop: async () => { stopped = true; clearInterval(timer); clearTimeout(first); await current; },
  };
}
