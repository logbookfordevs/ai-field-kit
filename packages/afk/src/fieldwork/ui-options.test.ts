import { describe, expect, it } from "vitest";
import { parseUiOptions } from "./ui-options.js";

describe("web launch options", () => {
  it("starts in the background and opens the browser by default, on an automatic port", () => {
    expect(parseUiOptions([])).toEqual({ port: 0, background: true, open: true });
    expect(parseUiOptions(["start"])).toEqual({ port: 0, background: true, open: true });
    expect(parseUiOptions(["ui"])).toEqual({ port: 0, background: true, open: true });
  });
  it("runs attached to the terminal only with --foreground", () => {
    expect(parseUiOptions(["--foreground"])).toEqual({ port: 0, background: false, open: true });
    expect(parseUiOptions(["start", "--foreground", "--no-open", "--port", "4310"])).toEqual({ port: 4310, background: false, open: false });
  });
  it("keeps --background for scripts and the app's own restart, without opening a browser", () => {
    expect(parseUiOptions(["--background", "--port", "4310"])).toEqual({ port: 4310, background: true, open: false });
  });
  it("combines a fixed port and --no-open with start", () => {
    expect(parseUiOptions(["start", "--port=4310", "--no-open"])).toEqual({ port: 4310, background: true, open: false });
  });
  it("refuses --foreground together with --background", () => {
    expect(() => parseUiOptions(["--foreground", "--background"])).toThrow("Use afk");
  });
  it.each([["--port"], ["--port", "0"], ["--port", "65536"], ["--port", "-1"], ["--port=4.2"], ["--port=abc"], ["--port=4310", "--port=4311"]])("rejects invalid port arguments %s", (...args) => {
    expect(() => parseUiOptions(args)).toThrow("Provide --port once");
  });
  it.each([6666, 6000, 10080, 22])("rejects browser-blocked port %s before launching", port => {
    expect(() => parseUiOptions(["--background", "--port", String(port)])).toThrow("blocked by browsers");
  });
  it("rejects other commands mixed into launch options", () => {
    expect(() => parseUiOptions(["profiles", "--background"])).toThrow("Use afk");
  });
});
