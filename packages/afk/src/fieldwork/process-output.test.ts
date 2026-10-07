import { expect, it } from "vitest";
import { ProcessOutput } from "./process-output.js";

it("keeps the latest progress frame across split control sequences", () => {
  const output = new ProcessOutput();
  output.append("Source ready\n◐ Cloning repository…");
  expect(output.append("\u001b[1")).toBe("Source ready\n◐ Cloning repository…");
  output.append("G\u001b[2");
  expect(output.append("K◒ Cloning repository…")).toBe("Source ready\n◒ Cloning repository…");
  expect(output.append("\r\u001b[KCloned\r\nInstalled\n")).toBe("Source ready\nCloned\nInstalled\n");
});

it("supports multiline redraws without deleting earlier logs or repeated warnings", () => {
  const output = new ProcessOutput();
  output.append("Warning\nWarning\nProgress\n");
  expect(output.append("\u001b[1A\u001b[2K\u001b[1GDone\n")).toBe("Warning\nWarning\nDone\n");
});

it("removes styling and hyperlink controls while retaining their text", () => {
  const output = new ProcessOutput();
  output.append("\u001b[32mSuccess\u001b[0m ");
  output.append("\u001b]8;;https://example.com");
  expect(output.append("\u001b\\link\u001b]8;;\u0007\n")).toBe("Success link\n");
});

it("bounds retained output while continuing to replace the current line", () => {
  const output = new ProcessOutput();
  expect(output.append("x".repeat(120_000) + "\nPending")).toHaveLength(100_000);
  const result = output.append("\r\u001b[2KDone\n");
  expect(result.length).toBeLessThanOrEqual(100_000);
  expect(result.endsWith("\nDone\n")).toBe(true);
  expect(result).not.toContain("Pending");
});
