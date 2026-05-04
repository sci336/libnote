import { describe, expect, it } from 'vitest';
import { getStorageFailureDetails } from './storageError';

describe('storageError', () => {
  it('maps quota-like failures to storage-full guidance', () => {
    const details = getStorageFailureDetails(new DOMException('Quota exceeded', 'QuotaExceededError'));

    expect(details.title).toBe('Changes could not be saved.');
    expect(details.message).toContain('storage appears to be full');
    expect(details.recovery).toBe('Export a backup before closing or refreshing.');
    expect(details.suggestion).toContain('Free browser storage');
  });

  it('maps unavailable storage failures to private browsing or blocked-storage guidance', () => {
    const details = getStorageFailureDetails(new DOMException('Blocked in private browsing', 'SecurityError'));

    expect(details.message).toContain('storage is unavailable or blocked');
    expect(details.suggestion).toContain('Leave private browsing');
  });

  it('keeps generic storage failures understandable', () => {
    const details = getStorageFailureDetails(new Error('Transaction failed'));

    expect(details.title).toBe('Changes could not be saved.');
    expect(details.message).toBe('Your latest edits may only exist in this open tab.');
    expect(details.technicalMessage).toBe('Transaction failed');
  });
});
