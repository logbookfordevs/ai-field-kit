import { describe, expect, it, vi } from "vitest";
import { createClient } from "@/api/client";

function respond(status: number, body: unknown): typeof fetch {
  return vi.fn(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status })) as unknown as typeof fetch;
}

describe("createClient", () => {
  it("posts the operation with the session token and returns the value", async () => {
    const fetcher = respond(200, { core: [], sources: [], tools: [], undecided: [], machineOnly: ["kami"] });
    const client = createClient({ token: "t0k", fetch: fetcher });

    const result = await client.run("kit/state");

    expect(result).toEqual({ ok: true, value: expect.objectContaining({ machineOnly: ["kami"] }) });
    expect(fetcher).toHaveBeenCalledWith("/api/kit/state", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "x-afk-token": "t0k" }),
      body: "{}",
    }));
  });

  it("returns the server's message and duplicate details as an error value", async () => {
    const client = createClient({ token: "t", fetch: respond(400, { error: "Two copies of kami exist.", code: "duplicate", skill: "kami", scope: "Global" }) });

    const result = await client.run("skill/availability", { name: "kami", scope: "Global", enabled: true });

    expect(result).toEqual({ ok: false, error: { message: "Two copies of kami exist.", status: 400, code: "duplicate", details: { skill: "kami", scope: "Global" } } });
  });

  it("explains an expired session instead of throwing", async () => {
    const client = createClient({ token: "old", fetch: respond(403, { error: "This session is not authorized. Reopen AFK from the CLI." }) });

    const result = await client.run("state");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatchObject({ status: 403, message: "This session is not authorized. Reopen AFK from the CLI." });
  });

  it("turns a stopped server and an unreadable reply into error values", async () => {
    const offline = createClient({ token: "t", fetch: vi.fn(async () => { throw new TypeError("Failed to fetch"); }) as unknown as typeof fetch });
    const garbled = createClient({ token: "t", fetch: respond(502, "<html>Bad gateway</html>") });

    const stopped = await offline.run("state");
    const unreadable = await garbled.run("state");

    expect(stopped).toEqual({ ok: false, error: expect.objectContaining({ status: 0, message: "AFK isn't responding. Check that it's still running, then try again." }) });
    expect(unreadable).toEqual({ ok: false, error: expect.objectContaining({ status: 502, message: "AFK sent a reply it couldn't read (HTTP 502)." }) });
  });

  it("keeps an error field inside a successful reply as data", async () => {
    const client = createClient({ token: "t", fetch: respond(200, { current: "2.1.0", available: false, error: "Could not reach GitHub." }) });

    const result = await client.app.updateCheck();

    expect(result).toEqual({ ok: true, value: { current: "2.1.0", available: false, error: "Could not reach GitHub." } });
  });

  it("reads the web-only update endpoints with GET", async () => {
    const fetcher = respond(200, { current: "2.1.0", available: true, latest: "2.2.0" });
    const client = createClient({ token: "t", fetch: fetcher });

    await client.app.updateCheck({ refresh: true });

    expect(fetcher).toHaveBeenCalledWith("/api/app/update-check?refresh=1", expect.objectContaining({ method: "GET" }));
  });
});
