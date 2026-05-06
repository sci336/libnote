import { describe, expect, it } from 'vitest';
import { getStorageFailureDetails } from './storageError';

describe('storageError', () => {
  it('maps quota-like failures to storage-full guidance', () => {
    const details = getStorageFailureDetails(new DOMException('Quota exceeded', 'QuotaExceededError'));

    expect(details.title).toBe('LibNote could not save locally.');
    expect(details.message).toContain('storage appears to be full');
    expect(details.recovery).toBe('If these changes are important, export a backup before closing or refreshing.');
    expect(details.suggestion).toContain('Export a backup');
    expect(details.suggestion).toContain('free browser storage');
  });

  it('maps unavailable storage failures to private browsing or blocked-storage guidance', () => {
    const details = getStorageFailureDetails(new DOMException('Blocked in private browsing', 'SecurityError'));

    expect(details.message).toContain('storage is unavailable or blocked');
    expect(details.suggestion).toContain('leave private browsing');
  });

  it('keeps generic storage failures understandable', () => {
    const details = getStorageFailureDetails(new Error('Transaction failed'));

    expect(details.title).toBe('LibNote could not save locally.');
    expect(details.message).toBe('Your latest changes are still open here, but they may not be saved in this browser yet.');
    expect(details.recovery).toContain('export a backup');
    expect(details.technicalMessage).toBe('Transaction failed');
  });
});
