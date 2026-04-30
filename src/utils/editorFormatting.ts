export interface TextSelection {
  start: number;
  end: number;
}

export interface EditorFormattingResult {
  text: string;
  selectionStart: number;
  selectionEnd: number;
}

export function wrapSelection(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  before: string,
  after: string,
  placeholder: string
): EditorFormattingResult {
  const start = clampIndex(selectionStart, text.length);
  const end = clampIndex(selectionEnd, text.length);
  const selectedText = text.slice(start, end);

  if (start !== end) {
    const nextText = `${text.slice(0, start)}${before}${selectedText}${after}${text.slice(end)}`;
    return {
      text: nextText,
      selectionStart: start + before.length,
      selectionEnd: start + before.length + selectedText.length
    };
  }

  const insertedText = `${before}${placeholder}${after}`;
  const nextText = `${text.slice(0, start)}${insertedText}${text.slice(end)}`;
  return {
    text: nextText,
    selectionStart: start + before.length,
    selectionEnd: start + before.length + placeholder.length
  };
}

export function applyHeading(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  level = 2
): EditorFormattingResult {
  const prefix = `${'#'.repeat(Math.min(Math.max(level, 1), 6))} `;
  return transformSelectedLines(text, selectionStart, selectionEnd, {
    transformLine: (line) => {
      if (line.startsWith(prefix)) {
        return line;
      }

      if (/^#{1,6}\s+/.test(line)) {
        return line.replace(/^#{1,6}\s+/, prefix);
      }

      return `${prefix}${line}`;
    },
    collapseSelection: 'preserve-caret'
  });
}

export function applyBulletList(
  text: string,
  selectionStart: number,
  selectionEnd: number
): EditorFormattingResult {
  return transformSelectedLines(text, selectionStart, selectionEnd, {
    transformLine: (line) => (line.startsWith('- ') ? line : `- ${line}`),
    collapseSelection: 'preserve-caret'
  });
}

export function applyNumberedList(
  text: string,
  selectionStart: number,
  selectionEnd: number
): EditorFormattingResult {
  return transformSelectedLines(text, selectionStart, selectionEnd, {
    transformLines: (lines) =>
      lines.map((line, index) => {
        const baseLine = line.replace(/^\d+\.\s+/, '');
        return `${index + 1}. ${baseLine}`;
      }),
    collapseSelection: 'preserve-caret'
  });
}

export function applyCheckbox(
  text: string,
  selectionStart: number,
  selectionEnd: number
): EditorFormattingResult {
  return transformSelectedLines(text, selectionStart, selectionEnd, {
    transformLine: (line) => {
      if (line.startsWith('- [ ] ')) {
        return `- [x] ${line.slice(6)}`;
      }

      if (/^- \[[xX]\] /.test(line)) {
        return line.slice(6);
      }

      return `- [ ] ${line}`;
    },
    collapseSelection: 'preserve-caret'
  });
}

interface TransformLineOptions {
  transformLine?: (line: string, index: number, lines: string[]) => string;
  transformLines?: (lines: string[]) => string[];
  collapseSelection: 'preserve-caret' | 'select-block';
}

function transformSelectedLines(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  options: TransformLineOptions
): EditorFormattingResult {
  const normalizedSelection = normalizeSelection(text, selectionStart, selectionEnd);
  const lineRange = getLineRange(text, normalizedSelection.start, normalizedSelection.end);
  const selectedBlock = text.slice(lineRange.start, lineRange.end);
  const lines = selectedBlock.split('\n');
  const nextLines = options.transformLines
    ? options.transformLines(lines)
    : lines.map((line, index, currentLines) => options.transformLine?.(line, index, currentLines) ?? line);
  const replacement = nextLines.join('\n');
  const nextText = `${text.slice(0, lineRange.start)}${replacement}${text.slice(lineRange.end)}`;

  if (normalizedSelection.start === normalizedSelection.end && options.collapseSelection === 'preserve-caret') {
    const delta = (nextLines[0] ?? '').length - (lines[0] ?? '').length;
    const nextCaret = clampIndex(normalizedSelection.start + delta, nextText.length);
    return {
      text: nextText,
      selectionStart: nextCaret,
      selectionEnd: nextCaret
    };
  }

  return {
    text: nextText,
    selectionStart: lineRange.start,
    selectionEnd: lineRange.start + replacement.length
  };
}

function normalizeSelection(text: string, start: number, end: number): TextSelection {
  const normalizedStart = clampIndex(start, text.length);
  const normalizedEnd = clampIndex(end, text.length);

  return normalizedStart <= normalizedEnd
    ? { start: normalizedStart, end: normalizedEnd }
    : { start: normalizedEnd, end: normalizedStart };
}

function getLineRange(text: string, selectionStart: number, selectionEnd: number): TextSelection {
  const start = text.lastIndexOf('\n', Math.max(selectionStart - 1, 0)) + 1;
  const inclusiveEnd = selectionEnd > selectionStart && text[selectionEnd - 1] === '\n' ? selectionEnd - 1 : selectionEnd;
  const lineBreakIndex = text.indexOf('\n', inclusiveEnd);

  return {
    start,
    end: lineBreakIndex === -1 ? text.length : lineBreakIndex
  };
}

function clampIndex(value: number, max: number): number {
  return Math.min(Math.max(value, 0), max);
}
