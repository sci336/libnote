import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { AppSettings, LibraryData, Page, SaveStatus } from '../types/domain';
import {
  clearRestoreRecoverySnapshot,
  saveAppSettings,
  saveRestoreRecoverySnapshot,
  type RestoreRecoverySnapshot
} from '../db/indexedDb';
import { persistLibraryData } from '../store/libraryStore';
import { DEFAULT_APP_SETTINGS, filterRecentPageIdsForLibrary, normalizeAppSettings } from '../utils/appSettings';
import {
  createBackupFileName,
  createBackupPayload,
  createBackupSummary,
  createSafetyBackupSnapshot,
  createPageExportFile,
  downloadJsonFile,
  downloadPlainTextFile,
  mergeBackupIntoLibrary,
  readBackupFile,
  validateBackupPayload,
  type BackupImportPreview,
  type BackupMergeReport,
  type BackupSafetySnapshot,
  type ValidatedBackupPayload
} from '../utils/backup';
import { getStorageFailureDetails } from '../utils/storageError';

interface BackupStatus {
  tone: 'success' | 'error' | 'info' | 'warning';
  message: string;
  warnings?: string[];
}

interface MutableValueRef<T> {
  current: T;
}

interface UseLibraryBackupActionsOptions {
  data: LibraryData | null;
  latestDataRef: MutableValueRef<LibraryData | null>;
  latestSettingsRef: MutableValueRef<AppSettings>;
  shouldAutosaveDataRef: MutableValueRef<boolean>;
  setData: Dispatch<SetStateAction<LibraryData | null>>;
  setSettings: Dispatch<SetStateAction<AppSettings>>;
  setSaveStatus: Dispatch<SetStateAction<SaveStatus>>;
  getPageById: (pageId: string) => Page | undefined;
  resetAfterLibraryReplacement: (nextData: LibraryData, nextSettings: AppSettings) => void;
}

export function useLibraryBackupActions({
  data,
  latestDataRef,
  latestSettingsRef,
  shouldAutosaveDataRef,
  setData,
  setSettings,
  setSaveStatus,
  getPageById,
  resetAfterLibraryReplacement
}: UseLibraryBackupActionsOptions) {
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [restoreSafetySnapshot, setRestoreSafetySnapshot] = useState<BackupSafetySnapshot | null>(null);
  const [restoreRecoverySnapshot, setRestoreRecoverySnapshot] = useState<RestoreRecoverySnapshot | null>(null);

  function handleExportLibrary(): void {
    if (!data) {
      setBackupStatus({ tone: 'error', message: 'Library data is still loading. Please try export again in a moment.' });
      return;
    }

    const payload = createBackupPayload(data, latestSettingsRef.current);
    const nextSettings = {
      ...latestSettingsRef.current,
      lastBackupExportedAt: payload.exportedAt
    };
    const payloadWithBackupTimestamp = {
      ...payload,
      settings: nextSettings
    };

    downloadJsonFile(createBackupFileName(payload.exportedAt), payloadWithBackupTimestamp);
    latestSettingsRef.current = nextSettings;
    setSettings(nextSettings);
    saveAppSettings(nextSettings).catch(console.error);
    setBackupStatus({
      tone: 'success',
      message: 'Backup created successfully. Check your browser downloads or Downloads folder.'
    });
  }

  function handleDownloadRestoreSafetySnapshot(): void {
    if (!restoreSafetySnapshot) {
      setBackupStatus({
        tone: 'info',
        message: 'No restore safety backup is available yet. Export the current library before restoring if you want a copy.'
      });
      return;
    }

    downloadJsonFile(restoreSafetySnapshot.filename, restoreSafetySnapshot.payload);
    setBackupStatus({
      tone: 'success',
      message: 'Safety backup downloaded. This is a copy of the library that was active before the restore attempt.'
    });
  }

  async function handlePreviewBackupImport(file: File | null): Promise<BackupImportPreview | null> {
    if (!file) {
      setBackupStatus({ tone: 'info', message: 'No file selected.' });
      return null;
    }

    try {
      const rawPayload = await readBackupFile(file);
      const validated = validateBackupPayload(rawPayload);
      const mergeReport = latestDataRef.current
        ? mergeBackupIntoLibrary(latestDataRef.current, validated.data).report
        : undefined;
      const preview = {
        fileName: file.name,
        summary: createBackupSummary(validated),
        validated,
        warnings: validated.warnings,
        mergeReport
      };

      setBackupStatus({
        tone: validated.warnings.length > 0 ? 'warning' : 'info',
        message:
          validated.warnings.length > 0
            ? 'Backup parsed with warnings. Review the preview before importing.'
            : 'Backup parsed successfully. Review the preview before importing.',
        warnings: validated.warnings
      });
      setRestoreSafetySnapshot(null);

      return preview;
    } catch (error) {
      setBackupStatus({
        tone: 'error',
        message: `Backup import failed: ${error instanceof Error ? error.message : 'invalid backup file.'}`
      });
      return null;
    }
  }

  async function handleRestoreBackupImport(validated: ValidatedBackupPayload): Promise<boolean> {
    const previousData = latestDataRef.current;
    const previousSettings = latestSettingsRef.current;
    const safetySnapshot = previousData ? createSafetyBackupSnapshot(previousData, previousSettings) : null;
    // A browser-local recovery snapshot is written before replacing IndexedDB.
    // It is intentionally separate from the downloadable safety backup so a
    // failed restore can still be recovered after refresh.
    const recoverySnapshot: RestoreRecoverySnapshot | null = previousData
      ? {
          kind: 'restore-recovery-snapshot',
          createdAt: new Date().toISOString(),
          data: previousData,
          settings: previousSettings
        }
      : null;

    setRestoreSafetySnapshot(safetySnapshot);

    try {
      const nextData = validated.data;
      const nextSettings =
        validated.settingsStatus === 'restored'
          ? validated.settings
          : filterRecentPageIdsForLibrary(DEFAULT_APP_SETTINGS, nextData.pages.map((page) => page.id));

      if (recoverySnapshot) {
        await saveRestoreRecoverySnapshot(recoverySnapshot);
        setRestoreRecoverySnapshot(recoverySnapshot);
      }

      try {
        await persistLibraryData(nextData);
      } catch (error) {
        throw createRestoreStageError('library', error);
      }

      try {
        await saveAppSettings(nextSettings);
      } catch (error) {
        throw createRestoreStageError('settings', error);
      }

      if (recoverySnapshot) {
        try {
          // Cleanup is part of the restore transaction from the user's point of
          // view; if it fails, keep the warning visible instead of silently
          // leaving stale recovery state behind.
          await clearRestoreRecoverySnapshot();
        } catch (error) {
          throw createRestoreStageError('cleanup', error);
        }
      }

      resetAfterLibraryReplacement(nextData, nextSettings);
      setRestoreSafetySnapshot(null);
      setRestoreRecoverySnapshot(null);
      setSaveStatus({ state: 'saved', lastSavedAt: Date.now() });
      setBackupStatus({
        tone: validated.warnings.length > 0 ? 'warning' : 'success',
        message:
          validated.warnings.length > 0
            ? 'Restore completed with warnings.'
            : 'Restore completed successfully.',
        warnings: validated.warnings
      });
      return true;
    } catch (error) {
      if (previousData) {
        latestDataRef.current = previousData;
        shouldAutosaveDataRef.current = false;
        setData(previousData);
      }

      latestSettingsRef.current = previousSettings;
      setSettings(previousSettings);
      setSaveStatus({
        state: 'failed',
        error: getStorageFailureDetails(getRestoreStageCause(error))
      });
      setBackupStatus({
        tone: 'error',
        message:
          `${getRestoreFailureMessage(error)} ` +
          'A restore recovery snapshot is saved in this browser so you can recover the previous library after refresh.'
      });
      return false;
    }
  }

  async function handleMergeBackupImport(validated: ValidatedBackupPayload): Promise<boolean> {
    const previousData = latestDataRef.current;
    const previousSettings = latestSettingsRef.current;

    if (!previousData) {
      setBackupStatus({ tone: 'error', message: 'Library data is still loading. Please try merge again in a moment.' });
      return false;
    }

    const safetySnapshot = createSafetyBackupSnapshot(previousData, previousSettings);
    const recoverySnapshot: RestoreRecoverySnapshot = {
      kind: 'restore-recovery-snapshot',
      createdAt: new Date().toISOString(),
      data: previousData,
      settings: previousSettings
    };
    const mergeResult = mergeBackupIntoLibrary(previousData, validated.data);
    const mergeWarnings = [...validated.warnings, ...mergeResult.report.warnings];

    setRestoreSafetySnapshot(safetySnapshot);

    try {
      // Merge uses the same recovery path as full restore because it still
      // overwrites the single IndexedDB library snapshot after composing data.
      await saveRestoreRecoverySnapshot(recoverySnapshot);
      setRestoreRecoverySnapshot(recoverySnapshot);

      try {
        await persistLibraryData(mergeResult.data);
      } catch (error) {
        throw createRestoreStageError('library', error);
      }

      try {
        await clearRestoreRecoverySnapshot();
      } catch (error) {
        throw createRestoreStageError('cleanup', error);
      }

      resetAfterLibraryReplacement(mergeResult.data, previousSettings);
      setRestoreSafetySnapshot(null);
      setRestoreRecoverySnapshot(null);
      setSaveStatus({ state: 'saved', lastSavedAt: Date.now() });
      setBackupStatus({
        tone: mergeWarnings.length > 0 ? 'warning' : 'success',
        message: `Merge completed. ${formatMergeReportSummary(mergeResult.report)}`,
        warnings: mergeWarnings
      });
      return true;
    } catch (error) {
      latestDataRef.current = previousData;
      shouldAutosaveDataRef.current = false;
      setData(previousData);
      latestSettingsRef.current = previousSettings;
      setSettings(previousSettings);
      setSaveStatus({
        state: 'failed',
        error: getStorageFailureDetails(getRestoreStageCause(error))
      });
      setBackupStatus({
        tone: 'error',
        message:
          `${getMergeFailureMessage(error)} ` +
          'A restore recovery snapshot is saved in this browser so you can recover the previous library after refresh.'
      });
      return false;
    }
  }

  async function handleRecoverRestoreSnapshot(): Promise<boolean> {
    const snapshot = restoreRecoverySnapshot;
    if (!snapshot) {
      setBackupStatus({ tone: 'info', message: 'No restore recovery snapshot is available.' });
      return false;
    }

    if (
      !window.confirm(
        'Recover the previous library from the restore recovery snapshot? This will replace the library currently open in this browser.'
      )
    ) {
      return false;
    }

    try {
      // Recovery settings are normalized against the recovered page ids so the
      // Recent Pages list cannot point at pages missing from the restored graph.
      const recoverySettings = filterRecentPageIdsForLibrary(
        normalizeAppSettings(snapshot.settings),
        snapshot.data.pages.map((page) => page.id)
      );

      try {
        await persistLibraryData(snapshot.data);
      } catch (error) {
        throw createRestoreStageError('library', error);
      }

      try {
        await saveAppSettings(recoverySettings);
      } catch (error) {
        throw createRestoreStageError('settings', error);
      }

      await clearRestoreRecoverySnapshot();

      resetAfterLibraryReplacement(snapshot.data, recoverySettings);
      setRestoreRecoverySnapshot(null);
      setRestoreSafetySnapshot(null);
      setSaveStatus({ state: 'saved', lastSavedAt: Date.now() });
      setBackupStatus({ tone: 'success', message: 'Previous library recovered from the restore recovery snapshot.' });
      return true;
    } catch (error) {
      setSaveStatus({
        state: 'failed',
        error: getStorageFailureDetails(getRestoreStageCause(error))
      });
      setBackupStatus({
        tone: 'error',
        message: `${getRestoreRecoveryFailureMessage(error)} The recovery snapshot was kept so you can try again.`
      });
      return false;
    }
  }

  async function handleDismissRestoreRecoverySnapshot(): Promise<boolean> {
    const snapshot = restoreRecoverySnapshot;
    if (!snapshot) {
      setBackupStatus({ tone: 'info', message: 'No restore recovery snapshot is available.' });
      return false;
    }

    if (
      !window.confirm(
        'Delete the restore recovery snapshot? This only removes the saved recovery copy; it will not change your current library.'
      )
    ) {
      return false;
    }

    try {
      await clearRestoreRecoverySnapshot();
      setRestoreRecoverySnapshot(null);
      setBackupStatus({ tone: 'info', message: 'Restore recovery snapshot dismissed. Your current library was not changed.' });
      return true;
    } catch (error) {
      setSaveStatus({
        state: 'failed',
        error: getStorageFailureDetails(error)
      });
      setBackupStatus({
        tone: 'error',
        message: `Could not delete the restore recovery snapshot: ${error instanceof Error ? error.message : 'unknown storage error.'}`
      });
      return false;
    }
  }

  function handleCancelBackupImport(): void {
    setRestoreSafetySnapshot(null);
    setBackupStatus({ tone: 'info', message: 'Import canceled. Your current library was not changed.' });
  }

  function handleExportPage(pageId: string): void {
    if (!data) {
      return;
    }

    const page = getPageById(pageId);
    if (!page) {
      setBackupStatus({ tone: 'error', message: 'Could not export that page because it is no longer available.' });
      return;
    }

    const exportFile = createPageExportFile(page);
    downloadPlainTextFile(exportFile.filename, exportFile.content);
    setBackupStatus({ tone: 'success', message: `Exported "${page.title || 'Untitled Page'}" as a text file.` });
  }

  return {
    backupStatus,
    restoreSafetySnapshot,
    restoreRecoverySnapshot,
    setBackupStatus,
    setRestoreRecoverySnapshot,
    handleExportLibrary,
    handleDownloadRestoreSafetySnapshot,
    handleRecoverRestoreSnapshot,
    handleDismissRestoreRecoverySnapshot,
    handlePreviewBackupImport,
    handleRestoreBackupImport,
    handleMergeBackupImport,
    handleCancelBackupImport,
    handleExportPage
  };
}

type RestoreStage = 'library' | 'settings' | 'cleanup';

interface RestoreStageError extends Error {
  stage: RestoreStage;
  cause: unknown;
}

function createRestoreStageError(stage: RestoreStage, cause: unknown): RestoreStageError {
  const stageLabel =
    stage === 'library'
      ? 'library data'
      : stage === 'settings'
        ? 'settings'
        : 'restore recovery cleanup';
  const causeMessage = cause instanceof Error ? cause.message : 'unknown storage error';
  const error = new Error(`Restore failed while saving ${stageLabel}: ${causeMessage}`) as RestoreStageError;
  error.stage = stage;
  error.cause = cause;
  return error;
}

// Stage-specific errors let the UI tell users whether a restore failed before
// data replacement, during settings save, or while clearing the recovery copy.
function isRestoreStageError(error: unknown): error is RestoreStageError {
  return error instanceof Error && 'stage' in error && 'cause' in error;
}

function getRestoreStageCause(error: unknown): unknown {
  return isRestoreStageError(error) ? error.cause : error;
}

function getRestoreFailureMessage(error: unknown): string {
  if (!isRestoreStageError(error)) {
    return `Restore failed while saving: ${error instanceof Error ? error.message : 'unknown storage error.'}`;
  }

  if (error.stage === 'library') {
    return `Restore failed before the library replacement was saved: ${getCauseMessage(error.cause)}`;
  }

  if (error.stage === 'settings') {
    return `Restore saved the library data but failed before settings were saved: ${getCauseMessage(error.cause)}`;
  }

  return `Restore saved the library and settings, but could not clear the recovery snapshot: ${getCauseMessage(error.cause)}`;
}

function getRestoreRecoveryFailureMessage(error: unknown): string {
  if (!isRestoreStageError(error)) {
    return `Recovery failed: ${error instanceof Error ? error.message : 'unknown storage error.'}`;
  }

  if (error.stage === 'library') {
    return `Recovery failed before the previous library was saved: ${getCauseMessage(error.cause)}`;
  }

  if (error.stage === 'settings') {
    return `Recovery saved the previous library but failed before settings were saved: ${getCauseMessage(error.cause)}`;
  }

  return `Recovery restored the previous library but could not delete the recovery snapshot: ${getCauseMessage(error.cause)}`;
}

function getMergeFailureMessage(error: unknown): string {
  if (!isRestoreStageError(error)) {
    return `Merge failed while saving: ${error instanceof Error ? error.message : 'unknown storage error.'}`;
  }

  if (error.stage === 'library') {
    return `Merge failed before the merged library was saved: ${getCauseMessage(error.cause)}`;
  }

  if (error.stage === 'settings') {
    return `Merge saved the library data but failed before settings were saved: ${getCauseMessage(error.cause)}`;
  }

  return `Merge saved the library, but could not clear the recovery snapshot: ${getCauseMessage(error.cause)}`;
}

function formatMergeReportSummary(report: BackupMergeReport): string {
  const additions = report.booksAdded + report.chaptersAdded + report.pagesAdded + report.loosePagesAdded;
  return `${additions} item${additions === 1 ? '' : 's'} added, ${report.skippedExisting} existing skipped, ${report.conflictsDuplicated} conflict${report.conflictsDuplicated === 1 ? '' : 's'} kept as imported duplicates.`;
}

function getCauseMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'unknown storage error.';
}
