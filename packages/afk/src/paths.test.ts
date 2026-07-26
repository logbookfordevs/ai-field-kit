import assert from "node:assert/strict";
import { test } from "vitest";
import { resolveHome } from "./paths.js";

test("resolveHome uses USERPROFILE when HOME is unavailable on Windows", () => {
  assert.equal(resolveHome({ USERPROFILE: "C:\\Users\\Leonardo" }), "C:\\Users\\Leonardo");
});

test("resolveHome keeps HOME precedence for Unix and compatibility shells", () => {
  assert.equal(resolveHome({
    HOME: "/home/leonardo",
    USERPROFILE: "C:\\Users\\Leonardo",
  }), "/home/leonardo");
});
