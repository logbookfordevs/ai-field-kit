export const uploadLimitBytes = 25 * 1024 * 1024;

export interface PickedFile {
  file: File;
  /** Path relative to the chosen folder's parent; empty for a single file. */
  path: string;
}

export type UploadPayload = { archive: string; name: string } | { files: { path: string; base64: string }[] };

function base64Of(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result.split(",")[1] ?? "" : "");
    reader.onerror = () => reject(reader.error ?? new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

/** Turns what the person chose into the `kit/upload-preview` input, or says why it cannot be used. */
export async function uploadPayload(items: readonly PickedFile[]): Promise<{ payload: UploadPayload } | { error: string }> {
  if (items.reduce((total, item) => total + item.file.size, 0) > uploadLimitBytes) {
    return { error: `That is too large. Skills can total at most ${uploadLimitBytes / 1024 / 1024} MB.` };
  }
  const folder = items.every(item => item.path);
  const single = items.length === 1 && !items[0]?.path;
  if (!folder && !single) return { error: "Choose one zip, one .skill file or one folder." };
  const [first] = items;
  if (single && first) return { payload: { archive: await base64Of(first.file), name: first.file.name } };
  return { payload: { files: await Promise.all(items.map(async item => ({ path: item.path, base64: await base64Of(item.file) }))) } };
}

function readEntries(entry: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  const reader = entry.createReader();
  const found: FileSystemEntry[] = [];
  return new Promise(resolve => {
    const next = (): void => reader.readEntries(batch => {
      if (!batch.length) resolve(found);
      else { found.push(...batch); next(); }
    }, () => resolve(found));
    next();
  });
}

async function filesIn(entry: FileSystemEntry, prefix = ""): Promise<PickedFile[]> {
  if (entry.isFile) {
    const file = await new Promise<File | null>(resolve => (entry as FileSystemFileEntry).file(resolve, () => resolve(null)));
    return file ? [{ file, path: prefix ? prefix + file.name : "" }] : [];
  }
  const children = await readEntries(entry as FileSystemDirectoryEntry);
  return (await Promise.all(children.map(child => filesIn(child, `${prefix}${entry.name}/`)))).flat();
}

/** Files and folders dropped onto the page, folders walked recursively. */
export async function droppedFiles(transfer: DataTransfer): Promise<PickedFile[]> {
  const entries = [...transfer.items].map(item => item.webkitGetAsEntry()).filter((entry): entry is FileSystemEntry => entry !== null);
  if (!entries.length) return [...transfer.files].map(file => ({ file, path: "" }));
  return (await Promise.all(entries.map(entry => filesIn(entry)))).flat();
}

export function chosenFiles(list: FileList | null): PickedFile[] {
  return [...(list ?? [])].map(file => ({ file, path: file.webkitRelativePath }));
}
