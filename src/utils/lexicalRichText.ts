import { $generateNodesFromDOM } from '@lexical/html';
import { createHeadlessEditor } from '@lexical/headless';
import { $createListItemNode, $createListNode, $isListItemNode, $isListNode, ListItemNode, ListNode } from '@lexical/list';
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
  if (appendSupportedDomChildren(root, doc.body)) {
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

function appendSupportedDomChildren(root: ElementNode, source: HTMLElement): boolean {
  let appended = false;

  source.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? '';
      if (text.trim().length === 0) {
        return;
      }

      const paragraph = $createParagraphNode();
      paragraph.append($createTextNode(text));
      root.append(paragraph);
      appended = true;
      return;
    }

    if (!(child instanceof HTMLElement)) {
      return;
    }

    if (child.tagName === 'P' || child.tagName === 'DIV') {
      const paragraph = $createParagraphNode();
      appendInlineDomChildren(paragraph, child, []);
      if (!paragraph.isEmpty()) {
        root.append(paragraph);
        appended = true;
      }
      return;
    }

    if (/^H[1-6]$/.test(child.tagName)) {
      const heading = $createHeadingNode(child.tagName.toLowerCase() as HeadingTagType);
      appendInlineDomChildren(heading, child, []);
      if (!heading.isEmpty()) {
        root.append(heading);
        appended = true;
      }
      return;
    }

    if (child.tagName === 'UL' || child.tagName === 'OL') {
      const list = $createListNode(child.tagName === 'OL' ? 'number' : 'bullet');
      child.childNodes.forEach((itemNode) => {
        if (!(itemNode instanceof HTMLElement) || itemNode.tagName !== 'LI') {
          return;
        }

        const item = $createListItemNode();
        appendInlineDomChildren(item, itemNode, []);
        list.append(item);
      });

      if (!list.isEmpty()) {
        root.append(list);
        appended = true;
      }
    }
  });

  return appended;
}

function appendInlineDomChildren(target: ElementNode, source: HTMLElement, formats: TextFormatType[]): void {
  source.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? '';
      if (text.length === 0) {
        return;
      }

      const textNode = $createTextNode(text);
      formats.forEach((format) => textNode.toggleFormat(format));
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

    appendInlineDomChildren(target, child, nextFormats);
  });
}

export function insertSanitizedHtmlIntoLexicalEditor(editor: LexicalEditor, html: string): void {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const nodes = $generateNodesFromDOM(editor, doc.body);

  if (nodes.length > 0) {
    $insertNodes(nodes);
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
    if (node.hasFormat('italic')) {
      text = `<em>${text}</em>`;
    }
    if (node.hasFormat('bold')) {
      text = `<strong>${text}</strong>`;
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
    const tag = node.getListType() === 'number' ? 'ol' : 'ul';
    return `<${tag}>${serializeElementChildren(node)}</${tag}>`;
  }

  if ($isListItemNode(node)) {
    return `<li>${serializeElementChildren(node)}</li>`;
  }

  if ($isElementNode(node)) {
    return serializeElementChildren(node);
  }

  return '';
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
