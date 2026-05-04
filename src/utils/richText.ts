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

const PASTE_INLINE_FORMAT_TAGS: Record<string, 'strong' | 'em' | 'u'> = {
  B: 'strong',
  STRONG: 'strong',
  I: 'em',
  EM: 'em',
  U: 'u'
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
    return createSanitizedElement('p', node);
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

  source.childNodes.forEach((child) => {
    if (child instanceof HTMLElement && child.tagName === 'LI') {
      list.appendChild(createSanitizedElement('li', child));
    }
  });

  return list;
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
