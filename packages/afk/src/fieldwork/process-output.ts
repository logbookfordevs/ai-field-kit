// Process output is a transcript of terminal line updates, not every spinner frame.
export class ProcessOutput {
  private lines = [""];
  private row = 0;
  private column = 0;
  private escape = "";

  append(text: string): string {
    for (const character of text) {
      if (this.escape) {
        this.escape += character;
        if (this.escape.startsWith("\u001b]")) {
          if (character === "\u0007" || this.escape.endsWith("\u001b\\")) this.escape = "";
        } else if (this.escape.length === 2 && character !== "[") this.escape = "";
        else if (this.escape.length > 2 && /[@-~]/.test(character)) {
          this.control(character, this.escape.slice(2, -1));
          this.escape = "";
        }
        if (this.escape.length > 4096) this.escape = "";
        continue;
      }
      if (character === "\u001b") { this.escape = character; continue; }
      if (character === "\r") { this.column = 0; continue; }
      if (character === "\n") {
        this.row++;
        this.lines[this.row] ??= "";
        this.column = 0;
        continue;
      }
      if (character === "\b") { this.column = Math.max(0, this.column - 1); continue; }
      if (character < " " && character !== "\t") continue;
      const line = this.lines[this.row] ?? "";
      this.lines[this.row] = line.slice(0, this.column).padEnd(this.column) + character + line.slice(this.column + character.length);
      this.column += character.length;
    }

    const output = this.lines.join("\n");
    if (output.length <= 100_000) return output;
    const retained = output.slice(-100_000);
    const removedRows = this.lines.length - retained.split("\n").length;
    this.lines = retained.split("\n");
    this.row = Math.max(0, this.row - removedRows);
    this.column = Math.min(this.column, (this.lines[this.row] ?? "").length);
    return retained;
  }

  private control(command: string, parameters: string): void {
    const value = Number(parameters.split(";")[0]) || 0;
    const distance = Math.min(value || 1, 100_000);
    if (command === "G") this.column = distance - 1;
    else if (command === "A") this.row = Math.max(0, this.row - distance);
    else if (command === "B") this.row = Math.min(this.lines.length - 1, this.row + distance);
    else if (command === "C") this.column = Math.min(100_000, this.column + distance);
    else if (command === "D") this.column = Math.max(0, this.column - distance);
    else if (command === "K") {
      const line = this.lines[this.row] ?? "";
      this.lines[this.row] = value === 2 ? "" : value === 1 ? " ".repeat(this.column + 1) + line.slice(this.column + 1) : line.slice(0, this.column);
    }
  }
}
