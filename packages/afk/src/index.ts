#!/usr/bin/env node
import { runFieldwork } from "./fieldwork/cli.js";

try {
  process.exitCode = await runFieldwork(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "AFK could not complete the operation.");
  process.exitCode = 1;
}
