import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export async function confirm(message: string): Promise<boolean> {
  const reader = createInterface({ input, output });
  const answer = await reader.question(`${message} [y/N] `);
  reader.close();
  return answer.trim().toLowerCase() === "y" || answer.trim().toLowerCase() === "yes";
}
