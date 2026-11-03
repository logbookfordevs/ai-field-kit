import { afterEach, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { isDue, latestSlot, nextSlot, SkillUpdateSchedule, startSchedule, type ScheduleChoice } from "./skill-schedule.js";
import type { UpdateProgress } from "./skill-update.js";

const homes: string[] = [];
afterEach(async () => { await Promise.all(homes.map(home => rm(home, { recursive: true, force: true }))); homes.length = 0; });

async function schedule(): Promise<SkillUpdateSchedule> {
  const home = await mkdtemp(join(tmpdir(), "afk-schedule-test-")); homes.push(home);
  return new SkillUpdateSchedule(home);
}

const at = (day: number, hours: number, minutes = 0): Date => new Date(2026, 10, day, hours, minutes);
const weekly: ScheduleChoice = { enabled: true, frequency: "weekly", time: "09:00", weekday: 1 };
const daily: ScheduleChoice = { enabled: true, frequency: "daily", time: "09:00", weekday: 1 };
const success: UpdateProgress = { pending: false, phase: "Updated; availability preserved", output: "Updated sample\n", code: 0, updated: 2, scope: "Global" };

it("finds the most recent and following local slots", () => {
  expect(latestSlot(daily, at(4, 8))).toEqual(at(3, 9));
  expect(latestSlot(daily, at(4, 9))).toEqual(at(4, 9));
  expect(nextSlot(daily, at(4, 9))).toEqual(at(5, 9));
  expect(latestSlot(weekly, at(4, 12))).toEqual(at(2, 9));
  expect(latestSlot(weekly, at(2, 8))).toEqual(new Date(2026, 9, 26, 9));
  expect(nextSlot(weekly, at(4, 12))).toEqual(at(9, 9));
});

it("runs a slot missed while AFK was closed, but only once", () => {
  const chosen = at(1, 12).getTime();
  expect(isDue({ ...daily, since: chosen }, at(1, 20))).toBe(false);
  expect(isDue({ ...daily, since: chosen }, at(4, 7))).toBe(true);
  expect(isDue({ ...daily, since: chosen, lastAttemptAt: at(4, 7).getTime() }, at(4, 8))).toBe(false);
  expect(isDue({ ...daily, enabled: false, since: chosen }, at(4, 7))).toBe(false);
});

it("waits for the next slot after the schedule is chosen or changed", async () => {
  const store = await schedule();
  await store.choose({ ...daily, time: "08:00" }, at(4, 7));
  expect(isDue(await store.read(), at(4, 8, 30))).toBe(true);
  await store.choose({ ...daily, time: "08:00" }, at(4, 8, 30));
  expect(isDue(await store.read(), at(4, 8, 30))).toBe(true);
  const state = await store.choose({ ...daily, time: "06:00" }, at(4, 8, 30));
  expect(isDue(await store.read(), at(4, 8, 30))).toBe(false);
  expect(state.nextRunAt).toBe(at(5, 6).getTime());
});

it("rejects invalid schedules and keeps the previous choice", async () => {
  const store = await schedule();
  await store.choose(weekly, at(1, 12));
  await expect(store.choose({ ...weekly, time: "9am" })).rejects.toThrow("HH:MM");
  await expect(store.choose({ ...weekly, frequency: "hourly" })).rejects.toThrow("daily or weekly");
  await expect(store.choose({ ...weekly, weekday: 7 })).rejects.toThrow("weekday");
  expect(await store.read()).toMatchObject(weekly);
});

it("runs a due update once and records its result", async () => {
  const store = await schedule();
  await store.choose(daily, at(1, 12));
  let runs = 0;
  const runner = startSchedule(store, { now: () => at(4, 10), blocked: async () => false, update: async () => { runs++; return success; } });
  await runner.tick(); await runner.tick(); await runner.stop();
  expect(runs).toBe(1);
  expect((await store.state(at(4, 10))).lastResult).toMatchObject({ code: 0, updated: 2, output: "Updated sample\n" });
});

it("records a failed run without retrying it until the next slot", async () => {
  const store = await schedule();
  await store.choose(daily, at(1, 12));
  let now = at(4, 10), runs = 0;
  const runner = startSchedule(store, { now: () => now, blocked: async () => false, update: async () => { runs++; throw new Error("Skills CLI has no update receipt for this scope."); } });
  await runner.tick(); await runner.tick();
  expect(runs).toBe(1);
  expect((await store.read()).lastResult).toMatchObject({ code: 1, output: "Skills CLI has no update receipt for this scope." });
  now = at(5, 9); await runner.tick(); await runner.stop();
  expect(runs).toBe(2);
});

it("defers a due run while another update is in progress", async () => {
  const store = await schedule();
  await store.choose(daily, at(1, 12));
  let blocked = true, runs = 0;
  const runner = startSchedule(store, { now: () => at(4, 10), blocked: async () => blocked, update: async () => { runs++; return success; } });
  await runner.tick();
  expect(runs).toBe(0);
  expect((await store.read()).lastAttemptAt).toBeUndefined();
  blocked = false; await runner.tick(); await runner.stop();
  expect(runs).toBe(1);
});
