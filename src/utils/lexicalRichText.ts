import { $generateNodesFromDOM } from '@lexical/html';
import { createHeadlessEditor } from '@lexical/headless';
import {
  $createListItemNode,
  $createListNode,
  $isListItemNode,
  $isListNode,
  ListItemNode,
  ListNode,
  type ListType
} from '@lexical/list';
import { $createHeadingNode, $isHeadingNode, HeadingNode, QuoteNode, type HeadingTagType } from '@lexical/rich-text';
import {
  $createLineBreakNode,
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $insertNodes,
  $isElementNode,
  $isLineBreakNode,
  $isParagraphNode,
  $isTextNode,
  type ElementNode,
  type Klass,
  type LexicalEditor,
  type LexicalNode,
  type TextFormatType
} from 'lexical';
import { contentToEditableHtml, contentToPlainText, normalizeEditorHtml, sanitizePastedHtml, sanitizePastedPlainText } from './richText';

export const LIBNOTE_LEXICAL_NODES: Array<Klass<LexicalNode>> = [HeadingNode, QuoteNode, ListNode, ListItemNode];

export function createLibNoteLexicalEditor(): LexicalEditor {
  return createHeadlessEditor({
    namespace: 'LibNoteLexicalPrototype',
    nodes: LIBNOTE_LEXICAL_NODES,
    theme: {
      text: {
        underline: 'lexical-text-underline',
        strikethrough: 'lexical-text-strikethrough'
      },
      list: {
        checklist: 'lexical-checklist',
        listitem: 'lexical-listitem',
        listitemChecked: 'lexical-listitem-checked',
        listitemUnchecked: 'lexical-listitem-unchecked'
      }
    },
    onError(error) {
      throw error;
    }
  });
}

export function loadHtmlIntoLexicalEditor(editor: LexicalEditor, content: string): void {
  const root = $getRoot();
  root.clear();

  const html = contentToEditableHtml(content);
  if (html.trim().length === 0) {
    return;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const supportedNodes = createSupportedNodesFromDom(doc.body);
  if (supportedNodes.length > 0) {
    root.append(...supportedNodes);
    return;
  }

  const nodes = $generateNodesFromDOM(editor, doc.body);

  if (nodes.length === 0) {
    const plainText = contentToPlainText(content);
    if (plainText.length > 0) {
      const paragraph = $createParagraphNode();
      paragraph.append($createTextNode(plainText));
      root.append(paragraph);
    }
    return;
  }

  if (nodes.every((node) => !$isElementNode(node))) {
    const paragraph = $createParagraphNode();
    paragraph.append(...nodes);
    root.append(paragraph);
    return;
  }

  root.select();
  $insertNodes(nodes);
}

function createSupportedNodesFromDom(source: HTMLElement): LexicalNode[] {
  const nodes: LexicalNode[] = [];

  source.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? '';
      if (text.trim().length === 0) {
        return;
      }

      const paragraph = $createParagraphNode();
      paragraph.append($createTextNode(text));
      nodes.push(paragraph);
      return;
    }

    if (!(child instanceof HTMLElement)) {
      return;
    }

    if (child.tagName === 'P' || child.tagName === 'DIV') {
      const paragraph = $createParagraphNode();
      appendInlineDomChildren(paragraph, child, [], '');
      if (!paragraph.isEmpty()) {
        nodes.push(paragraph);
      }
      return;
    }

    if (/^H[1-6]$/.test(child.tagName)) {
      const heading = $createHeadingNode(child.tagName.toLowerCase() as HeadingTagType);
      appendInlineDomChildren(heading, child, [], '');
      if (!heading.isEmpty()) {
        nodes.push(heading);
      }
      return;
    }

    if (child.tagName === 'UL' || child.tagName === 'OL') {
      const list = createListNodeFromDom(child);
      if (list && !list.isEmpty()) {
        nodes.push(list);
      }
    }
  });

  return nodes;
}

function createListNodeFromDom(source: HTMLElement): ListNode | null {
  if (source.tagName !== 'UL' && source.tagName !== 'OL') {
    return null;
  }

  const listType = getDomListType(source);
  const list = $createListNode(listType);

  source.childNodes.forEach((itemNode) => {
    if (!(itemNode instanceof HTMLElement) || itemNode.tagName !== 'LI') {
      return;
    }

    const item = $createListItemNode(listType === 'check' ? itemNode.dataset.checked === 'true' : undefined);
    appendInlineDomChildren(item, itemNode, [], '');

    itemNode.childNodes.forEach((child) => {
      if (child instanceof HTMLElement && (child.tagName === 'UL' || child.tagName === 'OL')) {
        const nestedList = createListNodeFromDom(child);
        if (nestedList && !nestedList.isEmpty()) {
          item.append(nestedList);
        }
      }
    });

    list.append(item);
  });

  return list;
}

function getDomListType(source: HTMLElement): ListType {
  if (source.tagName === 'OL') {
    return 'number';
  }

  return source.dataset.listType === 'task' ? 'check' : 'bullet';
}

function appendInlineDomChildren(target: ElementNode, source: HTMLElement, formats: TextFormatType[], style: string): void {
  source.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? '';
      if (text.length === 0) {
        return;
      }

      const textNode = $createTextNode(text);
      formats.forEach((format) => textNode.toggleFormat(format));
      if (style) {
        textNode.setStyle(style);
      }
      target.append(textNode);
      return;
    }

    if (!(child instanceof HTMLElement)) {
      return;
    }

    if (child.tagName === 'BR') {
      target.append($createLineBreakNode());
      return;
    }

    if (child.tagName === 'UL' || child.tagName === 'OL') {
      return;
    }

    const nextFormats = [...formats];
    if (child.tagName === 'B' || child.tagName === 'STRONG') {
      nextFormats.push('bold');
    }
    if (child.tagName === 'I' || child.tagName === 'EM') {
      nextFormats.push('italic');
    }
    if (child.tagName === 'U') {
      nextFormats.push('underline');
    }
    if (child.tagName === 'MARK' || hasHighlightStyle(child)) {
      nextFormats.push('highlight');
    }

    let nextStyle = style;
    if (child.tagName === 'SPAN' && child.style.cssText) {
      const inlineStyle = extractPreservedStyle(child);
      if (inlineStyle) {
        nextStyle = nextStyle ? `${nextStyle}; ${inlineStyle}` : inlineStyle;
      }
    }

    appendInlineDomChildren(target, child, nextFormats, nextStyle);
  });
}

function extractPreservedStyle(element: HTMLElement): string {
  const parts: string[] = [];
  const fontSize = element.style.fontSize;
  if (fontSize) {
    parts.push(`font-size: ${fontSize}`);
  }
  return parts.join('; ');
}

export function insertSanitizedHtmlIntoLexicalEditor(editor: LexicalEditor, html: string): void {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const nodes = createSupportedNodesFromDom(doc.body);

  if (nodes.length > 0) {
    $insertNodes(nodes);
    return;
  }

  const generatedNodes = $generateNodesFromDOM(editor, doc.body);
  if (generatedNodes.length > 0) {
    $insertNodes(generatedNodes);
  }
}

export function sanitizeClipboardToHtml(html: string, text: string): string {
  return html.trim().length > 0 ? sanitizePastedHtml(html) : sanitizePastedPlainText(text);
}

export function lexicalEditorToHtml(editor: LexicalEditor): string {
  const html = $getRoot()
    .getChildren()
    .map((node) => serializeLexicalNode(node))
    .join('');

  return normalizeEditorHtml(html);
}

export function lexicalEditorToPlainText(): string {
  return $getRoot().getTextContent().trim();
}

function serializeLexicalNode(node: LexicalNode): string {
  if ($isTextNode(node)) {
    let text = escapeHtml(node.getTextContent());
    if (node.hasFormat('underline')) {
      text = `<u>${text}</u>`;
    }
    if (node.hasFormat('highlight')) {
      text = `<mark>${text}</mark>`;
    }
    if (node.hasFormat('italic')) {
      text = `<em>${text}</em>`;
    }
    if (node.hasFormat('bold')) {
      text = `<strong>${text}</strong>`;
    }
    const style = node.getStyle();
    if (style) {
      text = `<span style="${escapeHtml(style)}">${text}</span>`;
    }
    return text;
  }

  if ($isLineBreakNode(node)) {
    return '<br>';
  }

  if ($isParagraphNode(node)) {
    return `<p>${serializeElementChildren(node)}</p>`;
  }

  if ($isHeadingNode(node)) {
    return `<${node.getTag()}>${serializeElementChildren(node)}</${node.getTag()}>`;
  }

  if ($isListNode(node)) {
    if (node.getListType() === 'check') {
      return `<ul data-list-type="task">${serializeElementChildren(node)}</ul>`;
    }

    const tag = node.getListType() === 'number' ? 'ol' : 'ul';
    return `<${tag}>${serializeElementChildren(node)}</${tag}>`;
  }

  if ($isListItemNode(node)) {
    const checked = node.getChecked();
    if (typeof checked === 'boolean') {
      return `<li data-task-item="true" data-checked="${checked ? 'true' : 'false'}">${serializeElementChildren(
        node
      )}</li>`;
    }

    return `<li>${serializeElementChildren(node)}</li>`;
  }

  if ($isElementNode(node)) {
    return serializeElementChildren(node);
  }

  return '';
}

function hasHighlightStyle(source: HTMLElement): boolean {
  const backgroundColor = source.style.backgroundColor.trim();
  return backgroundColor.length > 0 && backgroundColor !== 'transparent' && backgroundColor !== 'rgba(0, 0, 0, 0)';
}

function serializeElementChildren(node: ElementNode): string {
  return node
    .getChildren()
    .map((child) => serializeLexicalNode(child))
    .join('');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
