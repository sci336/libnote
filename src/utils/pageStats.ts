import { contentToPlainText } from './richText';

const WORD_PATTERN = /[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu;
const AVERAGE_READING_WORDS_PER_MINUTE = 225;

export interface PageWritingStats {
  wordCount: number;
  characterCount: number;
  lineCount: number;
  readingTimeMinutes: number;
}

export function getPageWritingStats(content: string): PageWritingStats {
  const plainText = contentToPlainText(content);
  const trimmedText = plainText.trim();
  const words = trimmedText.match(WORD_PATTERN) ?? [];
  const lineCount = trimmedText.length === 0 ? 0 : plainText.split(/\r\n|\r|\n/).length;

  return {
    wordCount: words.length,
    characterCount: plainText.length,
    lineCount,
    readingTimeMinutes: Math.max(1, Math.ceil(words.length / AVERAGE_READING_WORDS_PER_MINUTE))
  };
}
