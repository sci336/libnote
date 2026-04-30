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

function serializeNodes(nodes: ChildNode[]): string[] {
  const lines: string[] = [];

  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = normalizeWhitespace(node.textContent ?? '');
      if (text.length > 0) {
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

    if (combined.length > 0) {
      lines.push(combined);
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
