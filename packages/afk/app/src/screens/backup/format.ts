export function changesWaiting(total: number): string {
  return total === 1 ? "1 change waiting" : `${total} changes waiting`;
}

export function megabytes(bytes: number): string {
  return bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Matches DAILY_BACKUP on the server. */
export const dailyBackupTime = "22:00";
