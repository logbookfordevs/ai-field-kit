import { describe, expect, it } from "vitest";
import { parseUiOptions } from "./ui-options.js";

describe("web launch options", () => {
  it("keeps automatic port selection by default", () => {
    expect(parseUiOptions([])).toEqual({ port: 0, background: false, open: true });
  });
  it("combines a fixed port with background and foreground options", () => {
    expect(parseUiOptions(["--background", "--port", "4310"])).toEqual({ port: 4310, background: true, open: true });
    expect(parseUiOptions(["ui", "--port=4310", "--no-open"])).toEqual({ port: 4310, background: false, open: false });
  });
  it.each([["--port"], ["--port", "0"], ["--port", "65536"], ["--port", "-1"], ["--port=4.2"], ["--port=abc"], ["--port=4310", "--port=4311"]])("rejects invalid port arguments %s", (...args) => {
    expect(() => parseUiOptions(args)).toThrow("Provide --port once");
  });
  it("rejects other commands mixed into launch options", () => {
    expect(() => parseUiOptions(["profiles", "--background"])).toThrow("Use afk");
  });
});
