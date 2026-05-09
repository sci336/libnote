import type { LibraryData } from '../types/domain';
import { deleteTagEverywhere, mergeTags, renameTagEverywhere } from '../store/libraryStore';
import { parseSingleTagInput } from '../utils/tags';

interface UseLibraryTagActionsOptions {
  data: LibraryData | null;
  updateData: (nextData: LibraryData) => void;
  renameRecentTag: (oldTag: string, newTag: string) => void;
  deleteRecentTag: (tag: string) => void;
  mergeRecentTags: (sourceTag: string, targetTag: string) => void;
}

export function useLibraryTagActions({
  data,
  updateData,
  renameRecentTag,
  deleteRecentTag,
  mergeRecentTags
}: UseLibraryTagActionsOptions) {
  function handleRenameTagEverywhere(oldTag: string, newTag: string): void {
    if (!data) {
      return;
    }

    const normalizedOldTag = parseSingleTagInput(oldTag);
    const normalizedNewTag = parseSingleTagInput(newTag);

    updateData(renameTagEverywhere(data, oldTag, newTag));
    if (normalizedOldTag && normalizedNewTag) {
      renameRecentTag(normalizedOldTag, normalizedNewTag);
    }
  }

  function handleDeleteTagEverywhere(tag: string): void {
    if (!data) {
      return;
    }

    const normalizedTag = parseSingleTagInput(tag);

    updateData(deleteTagEverywhere(data, tag));
    if (normalizedTag) {
      deleteRecentTag(normalizedTag);
    }
  }

  function handleMergeTags(sourceTag: string, targetTag: string): void {
    if (!data) {
      return;
    }

    const normalizedSourceTag = parseSingleTagInput(sourceTag);
    const normalizedTargetTag = parseSingleTagInput(targetTag);

    updateData(mergeTags(data, sourceTag, targetTag));
    if (normalizedSourceTag && normalizedTargetTag) {
      mergeRecentTags(normalizedSourceTag, normalizedTargetTag);
    }
  }

  return {
    handleRenameTagEverywhere,
    handleDeleteTagEverywhere,
    handleMergeTags
  };
}
