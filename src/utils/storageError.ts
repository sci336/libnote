import type { StorageFailureDetails } from '../types/domain';

const GENERIC_STORAGE_FAILURE: StorageFailureDetails = {
  title: 'Changes could not be saved.',
  message: 'Your latest edits may only exist in this open tab.',
  recovery: 'Export a backup before closing or refreshing.',
  suggestion: 'Browser storage may be full or unavailable. Try freeing browser storage, leaving private browsing, or using another browser.'
};

export function getStorageFailureDetails(error: unknown): StorageFailureDetails {
  const technicalMessage = getTechnicalMessage(error);
  const errorName = getErrorName(error);
  const errorMessage = (technicalMessage ?? '').toLowerCase();

  if (isQuotaError(errorName, errorMessage)) {
    return {
      ...GENERIC_STORAGE_FAILURE,
      message: 'Browser storage appears to be full, so your latest edits may only exist in this open tab.',
      suggestion: 'Free browser storage, clear unused site data, export a backup, then retry saving.',
      technicalMessage
    };
  }

  if (isUnavailableStorageError(errorName, errorMessage)) {
    return {
      ...GENERIC_STORAGE_FAILURE,
      message: 'Browser storage is unavailable or blocked, so your latest edits may only exist in this open tab.',
      suggestion: 'Leave private browsing, allow site storage, or use another browser, then retry saving.',
      technicalMessage
    };
  }

  return {
    ...GENERIC_STORAGE_FAILURE,
    technicalMessage
  };
}

function getTechnicalMessage(error: unknown): string | undefined {
  if (error instanceof DOMException) {
    return error.message || error.name;
  }

  if (error instanceof Error) {
    return error.message || error.name;
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  return undefined;
}

function getErrorName(error: unknown): string {
  if (error instanceof DOMException) {
    return error.name;
  }

  if (error instanceof Error) {
    return error.name;
  }

  return '';
}

function isQuotaError(errorName: string, errorMessage: string): boolean {
  const normalizedName = errorName.toLowerCase();
  return (
    normalizedName === 'quotaexceedederror' ||
    normalizedName === 'ns_error_dom_quota_reached' ||
    errorMessage.includes('quota') ||
    errorMessage.includes('storage full')
  );
}

function isUnavailableStorageError(errorName: string, errorMessage: string): boolean {
  const normalizedName = errorName.toLowerCase();
  return (
    normalizedName === 'securityerror' ||
    normalizedName === 'invalidstateerror' ||
    normalizedName === 'unknownerror' ||
    errorMessage.includes('indexeddb is unavailable') ||
    errorMessage.includes('storage is disabled') ||
    errorMessage.includes('private browsing') ||
    errorMessage.includes('permission denied')
  );
}
