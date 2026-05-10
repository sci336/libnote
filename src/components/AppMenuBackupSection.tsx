import { useState, type ChangeEvent } from 'react';
import type { AppSettings } from '../types/domain';
import type { RestoreRecoverySnapshot } from '../db/indexedDb';
import { formatLastBackupTime, getBackupReminderState } from '../utils/backupReminder';
import type { BackupImportPreview, BackupSafetySnapshot } from '../utils/backup';

interface BackupStatus {
  tone: 'success' | 'error' | 'info' | 'warning';
  message: string;
  warnings?: string[];
}

interface AppMenuBackupSectionProps {
  settings: AppSettings;
  backupStatus: BackupStatus | null;
  onExportLibrary: () => void;
  restoreSafetySnapshot: BackupSafetySnapshot | null;
  restoreRecoverySnapshot: RestoreRecoverySnapshot | null;
  onDownloadRestoreSafetySnapshot: () => void;
  onRecoverRestoreSnapshot: () => Promise<boolean>;
  onDismissRestoreRecoverySnapshot: () => Promise<boolean>;
  onPreviewBackupImport: (file: File | null) => Promise<BackupImportPreview | null>;
  onRestoreBackupImport: (validated: BackupImportPreview['validated']) => Promise<boolean>;
  onMergeBackupImport: (validated: BackupImportPreview['validated']) => Promise<boolean>;
  onCancelBackupImport: () => void;
}

export function AppMenuBackupSection({
  settings,
  backupStatus,
  onExportLibrary,
  restoreSafetySnapshot,
  restoreRecoverySnapshot,
  onDownloadRestoreSafetySnapshot,
  onRecoverRestoreSnapshot,
  onDismissRestoreRecoverySnapshot,
  onPreviewBackupImport,
  onRestoreBackupImport,
  onMergeBackupImport,
  onCancelBackupImport
}: AppMenuBackupSectionProps): JSX.Element {
  const [isImporting, setIsImporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [importPreview, setImportPreview] = useState<BackupImportPreview | null>(null);
  const reminderState = getBackupReminderState(settings.lastBackupExportedAt);
  const reminderTone = reminderState.type === 'current' ? 'success' : reminderState.type === 'stale' ? 'warning' : 'info';
  const reminderMessage =
    reminderState.type === 'current'
      ? 'Backup is up to date.'
      : reminderState.type === 'stale'
        ? `Last backup was ${reminderState.daysSinceBackup} days ago. Consider exporting a new backup.`
        : 'Backup recommended - your notes are saved only in this browser.';

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      return;
    }

    setIsImporting(true);

    try {
      const preview = await onPreviewBackupImport(file);
      setImportPreview(preview);
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  }

  async function restorePreview(): Promise<void> {
    if (!importPreview) {
      return;
    }

    setIsRestoring(true);

    try {
      const restored = await onRestoreBackupImport(importPreview.validated);
      if (restored) {
        setImportPreview(null);
      }
    } finally {
      setIsRestoring(false);
    }
  }

  async function mergePreview(): Promise<void> {
    if (!importPreview) {
      return;
    }

    setIsRestoring(true);

    try {
      const merged = await onMergeBackupImport(importPreview.validated);
      if (merged) {
        setImportPreview(null);
      }
    } finally {
      setIsRestoring(false);
    }
  }

  function cancelPreview(): void {
    setImportPreview(null);
    onCancelBackupImport();
  }

  return (
    <div className="menu-section-stack">
      <section className="menu-card">
        <h2>Backup &amp; Restore</h2>
        <p>
          LibNote stores your notes locally in this browser. Export backups regularly so you can recover your library
          if browser data is cleared, you switch devices, or you want a copy before making big changes.
        </p>
      </section>

      <section className={`menu-card backup-reminder-card is-${reminderTone}`} aria-live="polite">
        <div className="settings-placeholder-head">
          <h2>Backup Reminder</h2>
          <span className="search-result-badge">{reminderState.type === 'current' ? 'Current' : 'Recommended'}</span>
        </div>
        <p className="backup-last-export">{formatLastBackupTime(settings.lastBackupExportedAt)}</p>
        <p>{reminderMessage}</p>
        <p>
          Your notes are saved in this browser. Export backups regularly, especially before clearing browser data,
          switching devices, or importing another library.
        </p>
      </section>

      {restoreRecoverySnapshot ? (
        <section className="menu-card backup-status-card is-warning" aria-live="polite">
          <div className="settings-placeholder-head">
            <h2>Restore Recovery Snapshot</h2>
            <span className="search-result-badge">Available</span>
          </div>
          <p>
            LibNote found a previous library snapshot from an interrupted or failed restore. You can recover that
            previous library, or dismiss this snapshot if your current library looks right.
          </p>
          <p className="backup-safety-summary">
            Snapshot from {formatBackupDate(restoreRecoverySnapshot.createdAt)} ·{' '}
            {formatBackupCount(restoreRecoverySnapshot.data.books.length, 'book')},{' '}
            {formatBackupCount(restoreRecoverySnapshot.data.pages.length, 'page')}
          </p>
          <div className="backup-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                void onRecoverRestoreSnapshot();
              }}
            >
              Recover Previous Library
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                void onDismissRestoreRecoverySnapshot();
              }}
            >
              Dismiss Snapshot
            </button>
          </div>
        </section>
      ) : null}

      <section className="menu-card settings-card-grid">
        <article className="settings-placeholder-card settings-control-card">
          <div className="settings-placeholder-head">
            <strong>Full Library Backup</strong>
            <span className="search-result-badge">Local only</span>
          </div>
          <p>
            Download one <code>.json</code> file containing your books, chapters, pages, loose pages, page tags, page
            text sizes, recent pages, books-per-row setting, and custom shortcuts. Your browser may ask where to save
            the file, or it may place it directly in your Downloads folder.
          </p>
          <div className="backup-actions">
            <button type="button" className="primary-button" onClick={onExportLibrary}>
              Export Library
            </button>
          </div>
        </article>

        <article className="settings-placeholder-card settings-control-card">
          <div className="settings-placeholder-head">
            <strong>Import from Backup</strong>
            <span className="search-result-badge">Merge or replace</span>
          </div>
          <p>
            Import a previously exported JSON backup, then choose whether to merge it into the current library or
            replace the current library and saved settings. Export a backup first if you want an extra copy before
            making changes.
          </p>
          <label className="backup-import-label">
            <input
              type="file"
              accept=".json,application/json"
              className="backup-file-input"
              onChange={(event) => {
                void handleFileChange(event);
              }}
            />
            <span className="secondary-button">{isImporting ? 'Importing…' : 'Import Library'}</span>
          </label>
        </article>
      </section>

      {importPreview ? (
        <section className="menu-card backup-preview-card" aria-live="polite">
          <div className="settings-placeholder-head">
            <h2>Import Preview</h2>
            <span className="search-result-badge">{importPreview.summary.backupType}</span>
          </div>
          <p>
            Review <strong>{importPreview.fileName}</strong> before importing. Merge adds missing books, chapters,
            and pages without replacing settings. Replace current library performs a full restore and overwrites the
            current library and settings.
          </p>
          <p className="settings-warning">
            A safety snapshot of the current library is created before either import mode is applied.
          </p>
          <dl className="backup-preview-grid">
            <div>
              <dt>App</dt>
              <dd>{importPreview.summary.appName ?? 'Not included'}</dd>
            </div>
            <div>
              <dt>Backup date</dt>
              <dd>{formatBackupDate(importPreview.summary.exportedAt)}</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>{importPreview.summary.backupVersion ?? 'Not included'}</dd>
            </div>
            <div>
              <dt>Books</dt>
              <dd>{formatBackupCount(importPreview.summary.bookCount, 'book')}</dd>
            </div>
            <div>
              <dt>Chapters</dt>
              <dd>{formatBackupCount(importPreview.summary.chapterCount, 'chapter')}</dd>
            </div>
            <div>
              <dt>Pages</dt>
              <dd>{formatBackupCount(importPreview.summary.pageCount, 'page')}</dd>
            </div>
            <div>
              <dt>Loose pages</dt>
              <dd>{formatBackupCount(importPreview.summary.loosePageCount, 'loose page')}</dd>
            </div>
            <div>
              <dt>Trash</dt>
              <dd>{formatBackupCount(importPreview.summary.trashedItemCount, 'trashed item')}</dd>
            </div>
            <div>
              <dt>Tags</dt>
              <dd>{formatBackupCount(importPreview.summary.tagCount, 'tag')}</dd>
            </div>
          </dl>
          {importPreview.mergeReport ? (
            <>
              <h3 className="settings-subsection-heading">Merge Preview</h3>
              <dl className="backup-preview-grid">
                <div>
                  <dt>Books to add</dt>
                  <dd>{formatBackupCount(importPreview.mergeReport.booksAdded, 'book')}</dd>
                </div>
                <div>
                  <dt>Chapters to add</dt>
                  <dd>{formatBackupCount(importPreview.mergeReport.chaptersAdded, 'chapter')}</dd>
                </div>
                <div>
                  <dt>Pages to add</dt>
                  <dd>{formatBackupCount(importPreview.mergeReport.pagesAdded, 'page')}</dd>
                </div>
                <div>
                  <dt>Loose pages to add</dt>
                  <dd>{formatBackupCount(importPreview.mergeReport.loosePagesAdded, 'loose page')}</dd>
                </div>
                <div>
                  <dt>Existing skipped</dt>
                  <dd>{formatBackupCount(importPreview.mergeReport.skippedExisting, 'item')}</dd>
                </div>
                <div>
                  <dt>Conflicts duplicated</dt>
                  <dd>{formatBackupCount(importPreview.mergeReport.conflictsDuplicated, 'conflict')}</dd>
                </div>
                <div>
                  <dt>Ambiguous names</dt>
                  <dd>{formatBackupCount(importPreview.mergeReport.ambiguousItems, 'item')}</dd>
                </div>
                <div>
                  <dt>Trash</dt>
                  <dd>{formatBackupCount(importPreview.mergeReport.trashItemsSkipped, 'trashed item')} skipped</dd>
                </div>
                <div>
                  <dt>Settings</dt>
                  <dd>{importPreview.mergeReport.settingsIgnored ? 'Ignored for merge' : 'Merged'}</dd>
                </div>
                <div>
                  <dt>Recent pages</dt>
                  <dd>{importPreview.mergeReport.recentPagesUnchanged ? 'Unchanged' : 'Updated'}</dd>
                </div>
              </dl>
            </>
          ) : null}
          {importPreview.warnings.length > 0 ? (
            <ul className="menu-list backup-warning-list">
              {importPreview.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          <div className="backup-actions">
            <button type="button" className="secondary-button" onClick={onExportLibrary} disabled={isRestoring}>
              Export Current Library First
            </button>
            <button type="button" className="primary-button" onClick={() => void mergePreview()} disabled={isRestoring}>
              {isRestoring ? 'Importing…' : 'Merge into Current Library'}
            </button>
            <button type="button" className="danger-button" onClick={() => void restorePreview()} disabled={isRestoring}>
              {isRestoring ? 'Importing…' : 'Replace Current Library'}
            </button>
            <button type="button" className="secondary-button" onClick={cancelPreview} disabled={isRestoring}>
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {backupStatus ? (
        <section className={`menu-card backup-status-card is-${backupStatus.tone}`} aria-live="polite">
          <h2>Backup Status</h2>
          <p>{backupStatus.message}</p>
          {backupStatus.warnings && backupStatus.warnings.length > 0 ? (
            <ul className="menu-list backup-warning-list">
              {backupStatus.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          {backupStatus.tone === 'error' && restoreSafetySnapshot ? (
            <div className="backup-actions">
              <button type="button" className="secondary-button" onClick={onDownloadRestoreSafetySnapshot}>
                Download Safety Backup
              </button>
              <span className="backup-safety-summary">
                Safety copy: {formatBackupCount(restoreSafetySnapshot.summary.bookCount, 'book')},{' '}
                {formatBackupCount(restoreSafetySnapshot.summary.pageCount, 'page')}
              </span>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function formatBackupCount(value: number, singular: string, plural = `${singular}s`): string {
  return value === 1 ? `1 ${singular}` : `${value} ${plural}`;
}

function formatBackupDate(value: string | null): string {
  if (!value) {
    return 'Not included';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}
