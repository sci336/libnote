export const BACKUP_REMINDER_THRESHOLD_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

export type BackupReminderState =
  | { type: 'never' }
  | { type: 'stale'; daysSinceBackup: number }
  | { type: 'current' };

export function getBackupReminderState(
  lastBackupExportedAt: string | null | undefined,
  now = new Date()
): BackupReminderState {
  const exportedAt = parseBackupExportedAt(lastBackupExportedAt);

  if (!exportedAt) {
    return { type: 'never' };
  }

  const daysSinceBackup = getDaysSinceBackup(exportedAt, now);

  if (daysSinceBackup > BACKUP_REMINDER_THRESHOLD_DAYS) {
    return { type: 'stale', daysSinceBackup };
  }

  return { type: 'current' };
}

export function getDaysSinceBackup(exportedAt: Date, now = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - exportedAt.getTime()) / DAY_MS));
}

export function formatLastBackupTime(lastBackupExportedAt: string | null | undefined, now = new Date()): string {
  const exportedAt = parseBackupExportedAt(lastBackupExportedAt);

  if (!exportedAt) {
    return 'No backup exported yet.';
  }

  const time = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  }).format(exportedAt);

  if (isSameLocalDay(exportedAt, now)) {
    return `Last backup: Today at ${time}`;
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (isSameLocalDay(exportedAt, yesterday)) {
    return `Last backup: Yesterday at ${time}`;
  }

  const date = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(exportedAt);

  return `Last backup: ${date} at ${time}`;
}

export function parseBackupExportedAt(value: string | null | undefined): Date | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSameLocalDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}
