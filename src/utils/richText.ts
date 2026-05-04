const BLOCK_TAGS = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'DIV',
  'DL',
  'FIELDSET',
  'FIGCAPTION',
  'FIGURE',
  'FOOTER',
  'FORM',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HEADER',
  'HR',
  'LI',
  'MAIN',
  'NAV',
  'OL',
  'P',
  'PRE',
  'SECTION',
  'TABLE',
  'TD',
  'TH',
  'TR',
  'UL'
]);

const HTML_TAG_PATTERN = /<\/?[a-z][\w:-]*\b[^>]*>/i;

const PASTE_DISCARD_TAGS = new Set([
  'SCRIPT',
  'STYLE',
  'IFRAME',
  'OBJECT',
  'EMBED',
  'LINK',
  'META',
  'BASE',
  'FORM',
  'INPUT',
  'BUTTON',
  'SELECT',
  'TEXTAREA',
  'VIDEO',
  'AUDIO',
  'CANVAS',
  'SVG',
  'MATH'
]);

const PASTE_BLOCK_TAGS = new Set([
  'ADDRESS',
  'ARTICLE',
  'ASIDE',
  'BLOCKQUOTE',
  'DIV',
  'FIGCAPTION',
  'FIGURE',
  'FOOTER',
  'HEADER',
  'MAIN',
  'NAV',
  'PRE',
  'SECTION'
]);

const PASTE_INLINE_FORMAT_TAGS: Record<string, 'strong' | 'em' | 'u' | 'mark'> = {
  B: 'strong',
  STRONG: 'strong',
  I: 'em',
  EM: 'em',
  U: 'u',
  MARK: 'mark'
};

export function looksLikeHtmlContent(content: string): boolean {
  return HTML_TAG_PATTERN.test(content);
}

export function contentToEditableHtml(content: string): string {
  return looksLikeHtmlContent(content) ? content : plainTextToHtml(content);
}

export function plainTextToHtml(text: string): string {
  if (text.length === 0) {
    return '';
  }

  return text
    .split('\n')
    .map((line) => (line.length > 0 ? escapeHtml(line) : ''))
    .join('<br>');
}

export function sanitizePastedPlainText(text: string): string {
  return plainTextToHtml(text.replace(/\r\n?/g, '\n'));
}

export function sanitizePastedHtml(html: string): string {
  if (!looksLikeHtmlContent(html)) {
    return sanitizePastedPlainText(html);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const container = document.createElement('div');

  appendSanitizedChildren(container, doc.body);
  normalizeWordListParagraphs(container);
  stripEmptyBlocks(container);

  return container.innerHTML;
}

export function normalizeEditorHtml(html: string): string {
  if (!looksLikeHtmlContent(html)) {
    return html.trim();
  }

  const container = document.createElement('div');
  container.innerHTML = html;
  stripEditorArtifacts(container);

  if (container.textContent?.replace(/\u00a0/g, ' ').trim().length === 0) {
    return '';
  }

  return container.innerHTML;
}

export function contentToPlainText(content: string): string {
  if (!looksLikeHtmlContent(content)) {
    return content;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/html');
  const lines = serializeNodes(Array.from(doc.body.childNodes)).filter((line, index, allLines) => {
    if (line.length > 0) {
      return true;
    }

    return index > 0 && index < allLines.length - 1;
  });

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function contentToPreviewText(
  content: string,
  options: { maxLength: number; emptyText?: string } = { maxLength: 160 }
): string {
  const flattened = contentToPlainText(content).replace(/\s+/g, ' ').trim();
  if (!flattened) {
    return options.emptyText ?? '';
  }

  return flattened.length > options.maxLength ? `${flattened.slice(0, options.maxLength).trim()}...` : flattened;
}

function appendSanitizedChildren(target: Node, source: Node): void {
  source.childNodes.forEach((child) => {
    const sanitized = sanitizePastedNode(child);
    if (!sanitized) {
      return;
    }

    target.appendChild(sanitized);
  });
}

function sanitizePastedNode(node: Node): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return document.createTextNode(node.textContent ?? '');
  }

  if (!(node instanceof HTMLElement)) {
    return null;
  }

  if (PASTE_DISCARD_TAGS.has(node.tagName)) {
    return null;
  }

  if (node.tagName === 'BR') {
    return document.createElement('br');
  }

  if (node.tagName === 'P') {
    const paragraph = createSanitizedElement('p', node);
    const wordList = getWordListParagraphMetadata(node);
    if (wordList) {
      paragraph.dataset.pasteListType = wordList.type;
      paragraph.dataset.pasteListLevel = String(wordList.level);
    }
    return paragraph;
  }

  if (/^H[1-6]$/.test(node.tagName)) {
    const headingLevel = Math.min(Number(node.tagName.slice(1)), 3);
    return createSanitizedElement(`h${headingLevel}`, node);
  }

  if (node.tagName === 'UL' || node.tagName === 'OL') {
    return createSanitizedList(node);
  }

  if (node.tagName === 'LI') {
    return createSanitizedElement('li', node);
  }

  const inlineFormatTag = PASTE_INLINE_FORMAT_TAGS[node.tagName];
  if (inlineFormatTag) {
    return createSanitizedElement(inlineFormatTag, node);
  }

  if (hasWordListIgnoreStyle(node)) {
    return null;
  }

  if (node.tagName === 'SPAN' && hasHighlightStyle(node)) {
    return createSanitizedElement('mark', node);
  }

  if (node.tagName === 'SPAN') {
    const styledFormatTag = getInlineStyleFormatTag(node);
    if (styledFormatTag) {
      return createSanitizedElement(styledFormatTag, node);
    }
  }

  if (PASTE_BLOCK_TAGS.has(node.tagName)) {
    if (!hasSanitizedBlockChildren(node)) {
      return createSanitizedElement('p', node);
    }

    const fragment = document.createDocumentFragment();
    appendSanitizedChildren(fragment, node);
    return fragment;
  }

  const fragment = document.createDocumentFragment();
  appendSanitizedChildren(fragment, node);
  return fragment;
}

function createSanitizedElement(tagName: string, source: HTMLElement): HTMLElement {
  const element = document.createElement(tagName);
  appendSanitizedChildren(element, source);
  return element;
}

function createSanitizedList(source: HTMLElement): HTMLElement {
  const list = document.createElement(source.tagName.toLowerCase());
  const isTaskList = source.tagName === 'UL' && source.dataset.listType === 'task';

  if (isTaskList) {
    list.dataset.listType = 'task';
  }

  source.childNodes.forEach((child) => {
    if (child instanceof HTMLElement && child.tagName === 'LI') {
      const item = createSanitizedElement('li', child);
      if (isTaskList) {
        item.dataset.taskItem = 'true';
        item.dataset.checked = child.dataset.checked === 'true' ? 'true' : 'false';
      }
      list.appendChild(item);
    }
  });

  return list;
}

function hasHighlightStyle(source: HTMLElement): boolean {
  const backgroundColor = source.style.backgroundColor.trim();
  return backgroundColor.length > 0 && backgroundColor !== 'transparent' && backgroundColor !== 'rgba(0, 0, 0, 0)';
}

function getInlineStyleFormatTag(source: HTMLElement): 'strong' | 'em' | 'u' | 'mark' | null {
  const fontWeight = source.style.fontWeight.trim().toLowerCase();
  if (fontWeight === 'bold' || Number(fontWeight) >= 600) {
    return 'strong';
  }

  if (source.style.fontStyle.trim().toLowerCase() === 'italic') {
    return 'em';
  }

  if (source.style.textDecorationLine.includes('underline') || source.style.textDecoration.includes('underline')) {
    return 'u';
  }

  return hasHighlightStyle(source) ? 'mark' : null;
}

function hasWordListIgnoreStyle(source: HTMLElement): boolean {
  return source.getAttribute('style')?.toLowerCase().includes('mso-list:ignore') ?? false;
}

function getWordListParagraphMetadata(source: HTMLElement): { type: 'ul' | 'ol'; level: number } | null {
  const className = source.className.toString().toLowerCase();
  const style = source.getAttribute('style')?.toLowerCase() ?? '';

  if (!className.includes('msolistparagraph') && !style.includes('mso-list')) {
    return null;
  }

  const levelMatch = style.match(/\blevel(\d+)/);
  const level = Math.max(1, Math.min(6, levelMatch ? Number(levelMatch[1]) : 1));
  const text = source.textContent?.replace(/\u00a0/g, ' ').trim() ?? '';
  const type = /^\s*(\d+|[a-z]|[ivxlcdm]+)[.)]/i.test(text) ? 'ol' : 'ul';

  return { type, level };
}

function normalizeWordListParagraphs(container: HTMLElement): void {
  normalizeWordListParagraphChildren(container);
  Array.from(container.children).forEach((child) => {
    if (child instanceof HTMLElement) {
      normalizeWordListParagraphs(child);
    }
  });
}

function normalizeWordListParagraphChildren(container: HTMLElement): void {
  const stack: Array<{ level: number; type: 'ul' | 'ol'; list: HTMLElement; lastItem: HTMLLIElement | null }> = [];

  Array.from(container.children).forEach((child) => {
    if (!(child instanceof HTMLElement)) {
      return;
    }

    const type = child.dataset.pasteListType as 'ul' | 'ol' | undefined;
    const level = Number(child.dataset.pasteListLevel ?? '0');
    if ((type !== 'ul' && type !== 'ol') || !Number.isFinite(level) || level < 1) {
      stack.length = 0;
      return;
    }

    while (stack.length > 0 && stack[stack.length - 1].level > level) {
      stack.pop();
    }

    let frame = stack[stack.length - 1];
    if (!frame || frame.level < level || frame.type !== type) {
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      const list = document.createElement(type);
      if (stack.length === 0) {
        container.insertBefore(list, child);
      } else {
        const parentItem = stack[stack.length - 1].lastItem;
        if (parentItem) {
          parentItem.appendChild(list);
        } else {
          container.insertBefore(list, child);
        }
      }

      frame = { level, type, list, lastItem: null };
      stack.push(frame);
    }

    const item = document.createElement('li');
    delete child.dataset.pasteListType;
    delete child.dataset.pasteListLevel;
    while (child.firstChild) {
      item.appendChild(child.firstChild);
    }
    frame.list.appendChild(item);
    frame.lastItem = item;
    child.remove();
  });
}

function hasSanitizedBlockChildren(source: HTMLElement): boolean {
  return Array.from(source.children).some((child) => {
    if (!(child instanceof HTMLElement) || PASTE_DISCARD_TAGS.has(child.tagName)) {
      return false;
    }

    return child.tagName === 'P' || child.tagName === 'UL' || child.tagName === 'OL' || /^H[1-6]$/.test(child.tagName);
  });
}

function stripEmptyBlocks(container: HTMLElement): void {
  container.querySelectorAll('p, h1, h2, h3, li').forEach((element) => {
    const hasVisibleText = (element.textContent ?? '').replace(/\u00a0/g, ' ').trim().length > 0;
    if (!hasVisibleText && element.querySelector('br, ul, ol') === null) {
      element.remove();
    }
  });

  container.querySelectorAll('ul, ol').forEach((element) => {
    if (element.children.length === 0) {
      element.remove();
    }
  });
}

function serializeNodes(nodes: ChildNode[]): string[] {
  const lines: string[] = [];

  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = normalizeInlineWhitespace(node.textContent ?? '');
      if (text.trim().length > 0 || (lines.length > 0 && lines[lines.length - 1].length > 0)) {
        appendInline(lines, text);
      }
      continue;
    }

    if (!(node instanceof HTMLElement)) {
      continue;
    }

    if (node.tagName === 'BR') {
      lines.push('');
      continue;
    }

    if (node.tagName === 'UL' || node.tagName === 'OL') {
      lines.push(...serializeList(node));
      continue;
    }

    const childLines = serializeNodes(Array.from(node.childNodes));
    const combined = childLines.join('\n').trimEnd();

    if (combined.length > 0 && BLOCK_TAGS.has(node.tagName)) {
      lines.push(combined);
    } else if (combined.length > 0) {
      appendInline(lines, combined);
    } else if (BLOCK_TAGS.has(node.tagName)) {
      lines.push('');
    }
  }

  return lines;
}

function serializeList(list: HTMLElement): string[] {
  const items = Array.from(list.children).filter((child): child is HTMLLIElement => child instanceof HTMLLIElement);
  const isTaskList = list.dataset.listType === 'task';

  return items.flatMap((item, index) => {
    const nestedLists = Array.from(item.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement && (child.tagName === 'UL' || child.tagName === 'OL')
    );
    const clone = item.cloneNode(true) as HTMLLIElement;

    for (const nestedList of nestedLists) {
      const nestedClone = clone.querySelector(`${nestedList.tagName.toLowerCase()}`);
      nestedClone?.remove();
    }

    const text = normalizeWhitespace(clone.textContent ?? '');
    const marker = isTaskList
      ? item.dataset.checked === 'true'
        ? '- [x] '
        : '- [ ] '
      : list.tagName === 'OL'
        ? `${index + 1}. `
        : '- ';

    const currentLines = [`${marker}${text}`.trimEnd()];
    const nestedLines = nestedLists.flatMap((nestedList) =>
      serializeList(nestedList).map((line) => (line.length > 0 ? `  ${line}` : line))
    );

    return [...currentLines, ...nestedLines];
  });
}

function appendInline(lines: string[], text: string): void {
  if (lines.length === 0) {
    lines.push(text);
    return;
  }

  const lastLine = lines[lines.length - 1];
  if (lastLine.length === 0) {
    lines[lines.length - 1] = text;
    return;
  }

  lines[lines.length - 1] = `${lastLine}${text}`;
}

function stripEditorArtifacts(container: HTMLElement): void {
  container.querySelectorAll('[style]').forEach((element) => {
    const value = element.getAttribute('style');
    if (value?.trim() === '') {
      element.removeAttribute('style');
    }
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/[ \t\f\v]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}

function normalizeInlineWhitespace(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/[ \t\f\v]+/g, ' ').replace(/\s*\n\s*/g, '\n');
}
