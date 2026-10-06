import { spawn } from "node:child_process";

export const installerCommand = "curl -fsSL https://ai-field-kit.logbookfordevs.com/install.sh | bash";
export const updateHelp = `AFK update — update the AFK CLI from the latest GitHub release

  afk update
  afk update --dry-run

Runs the hosted AFK installer, using the same release archive as a fresh install.
--dry-run prints the command without downloading or installing anything.
This updates AFK itself; skill package updates remain separate.`;

export async function updateAfk(argv: string[]): Promise<number> {
  if (argv.length > 1 || (argv.length === 1 && !["--dry-run", "--help", "-h", "help"].includes(argv[0]!))) throw new Error("Use afk update [--dry-run].");
  if (argv[0] && ["--help", "-h", "help"].includes(argv[0])) { console.log(updateHelp); return 0; }
  if (argv[0] === "--dry-run") { console.log(installerCommand); return 0; }
  console.log("Updating AFK from the latest GitHub release...");
  const code = await new Promise<number>((accept, reject) => {
    const child = spawn("bash", ["-o", "pipefail", "-c", installerCommand], { stdio: "inherit" });
    child.once("error", reject);
    child.once("close", code => accept(code ?? 1));
  });
  if (code !== 0) {
    console.error("AFK update failed. You can rerun the installer directly:");
    console.error(installerCommand);
  }
  return code;
}
