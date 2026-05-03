import { createElement, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  parseContentIntoSegments,
  type ContentSegment,
  type PageTitleLookup
} from '../utils/pageLinks';
import { looksLikeHtmlContent } from '../utils/richText';

interface WikiLinkPreviewProps {
  content: string;
  contentSegments: ContentSegment[];
  titleLookup: PageTitleLookup;
  destinationLabels: Map<string, string>;
  textSize: number;
  onOpenPage: (pageId: string) => void;
  onCreatePageFromLink: (title: string) => void;
}

const ALLOWED_ELEMENT_TAGS = new Set([
  'B',
  'BLOCKQUOTE',
  'BR',
  'CODE',
  'DIV',
  'EM',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'I',
  'LI',
  'MARK',
  'OL',
  'P',
  'PRE',
  'S',
  'SPAN',
  'STRONG',
  'U',
  'UL'
]);

const BLOCKED_ELEMENT_TAGS = new Set(['IFRAME', 'OBJECT', 'SCRIPT', 'STYLE', 'TEMPLATE']);

export function WikiLinkPreview({
  content,
  contentSegments,
  titleLookup,
  destinationLabels,
  textSize,
  onOpenPage,
  onCreatePageFromLink
}: WikiLinkPreviewProps): JSX.Element {
  const [activePickerKey, setActivePickerKey] = useState<string | null>(null);
  const previewNodes = useMemo(
    () =>
      looksLikeHtmlContent(content)
        ? renderSafeRichContent(
            content,
            titleLookup,
            destinationLabels,
            activePickerKey,
            setActivePickerKey,
            onOpenPage,
            onCreatePageFromLink
          )
        : renderSegments(
            contentSegments,
            destinationLabels,
            activePickerKey,
            setActivePickerKey,
            onOpenPage,
            onCreatePageFromLink,
            'plain'
          ),
    [activePickerKey, content, contentSegments, destinationLabels, onCreatePageFromLink, onOpenPage, titleLookup]
  );
  const hasPreviewContent = contentSegments.some((segment) => {
    if (segment.type === 'text') {
      return segment.text.trim().length > 0;
    }

    return segment.displayText.trim().length > 0;
  });

  if (!hasPreviewContent) {
    return (
      <div className="wiki-link-preview wiki-link-preview-empty" style={{ fontSize: `${textSize}px` }}>
        Nothing to preview yet.
      </div>
    );
  }

  return (
    <div className="wiki-link-preview" style={{ fontSize: `${textSize}px` }} aria-label="Page preview">
      {previewNodes}
    </div>
  );
}

function renderSafeRichContent(
  content: string,
  titleLookup: PageTitleLookup,
  destinationLabels: Map<string, string>,
  activePickerKey: string | null,
  setActivePickerKey: (key: string | null) => void,
  onOpenPage: (pageId: string) => void,
  onCreatePageFromLink: (title: string) => void
): ReactNode[] {
  const doc = new DOMParser().parseFromString(content, 'text/html');
  return Array.from(doc.body.childNodes).flatMap((node, index) =>
    renderSafeNode(
      node,
      `rich-${index}`,
      titleLookup,
      destinationLabels,
      activePickerKey,
      setActivePickerKey,
      onOpenPage,
      onCreatePageFromLink
    )
  );
}

function renderSafeNode(
  node: ChildNode,
  key: string,
  titleLookup: PageTitleLookup,
  destinationLabels: Map<string, string>,
  activePickerKey: string | null,
  setActivePickerKey: (key: string | null) => void,
  onOpenPage: (pageId: string) => void,
  onCreatePageFromLink: (title: string) => void
): ReactNode[] {
  if (node.nodeType === Node.TEXT_NODE) {
    return renderSegments(
      parseContentIntoSegments(node.textContent ?? '', titleLookup),
      destinationLabels,
      activePickerKey,
      setActivePickerKey,
      onOpenPage,
      onCreatePageFromLink,
      key
    );
  }

  if (!(node instanceof HTMLElement) || BLOCKED_ELEMENT_TAGS.has(node.tagName)) {
    return [];
  }

  const children = Array.from(node.childNodes).flatMap((child, index) =>
    renderSafeNode(
      child,
      `${key}-${index}`,
      titleLookup,
      destinationLabels,
      activePickerKey,
      setActivePickerKey,
      onOpenPage,
      onCreatePageFromLink
    )
  );

  if (!ALLOWED_ELEMENT_TAGS.has(node.tagName)) {
    return children;
  }

  if (node.tagName === 'BR') {
    return [<br key={key} />];
  }

  return [
    createElementForTag(node.tagName.toLowerCase(), {
      key,
      style: getSafeStyle(node),
      ...getSafeDataAttributes(node)
    }, children)
  ];
}

function renderSegments(
  segments: ContentSegment[],
  destinationLabels: Map<string, string>,
  activePickerKey: string | null,
  setActivePickerKey: (key: string | null) => void,
  onOpenPage: (pageId: string) => void,
  onCreatePageFromLink: (title: string) => void,
  keyPrefix: string
): ReactNode[] {
  return segments.map((segment, index) => {
    if (segment.type === 'text') {
      return <span key={`${keyPrefix}-text-${index}`}>{segment.text}</span>;
    }

    const label = segment.displayText || segment.raw;
    const pickerKey = `${keyPrefix}-link-${index}-${segment.raw}`;
    const isResolved = segment.resolutionStatus === 'resolved';
    const isAmbiguous = segment.resolutionStatus === 'ambiguous';

    return (
      <span key={pickerKey} className="inline-page-link-shell">
        <button
          type="button"
          className={`inline-page-link${isResolved ? '' : ' unresolved'}${isAmbiguous ? ' ambiguous' : ''}`}
          title={getLinkTitle(label, segment)}
          aria-expanded={isAmbiguous ? activePickerKey === pickerKey : undefined}
          onClick={() => {
            if (segment.targetPageId) {
              onOpenPage(segment.targetPageId);
              return;
            }

            if (isAmbiguous) {
              setActivePickerKey(activePickerKey === pickerKey ? null : pickerKey);
              return;
            }

            onCreatePageFromLink(label);
          }}
        >
          {label}
        </button>
        {isAmbiguous && activePickerKey === pickerKey ? (
          <span className="wiki-link-destination-picker" role="menu" aria-label={`Choose destination for ${label}`}>
            <span className="wiki-link-destination-picker-title">Choose destination</span>
            {segment.matchingPageIds.map((pageId) => (
              <button
                key={pageId}
                type="button"
                className="wiki-link-destination-option"
                role="menuitem"
                onClick={() => {
                  setActivePickerKey(null);
                  onOpenPage(pageId);
                }}
              >
                {destinationLabels.get(pageId) ?? label}
              </button>
            ))}
            <button
              type="button"
              className="wiki-link-destination-close"
              onClick={() => setActivePickerKey(null)}
            >
              Cancel
            </button>
          </span>
        ) : null}
      </span>
    );
  });
}

function getLinkTitle(label: string, segment: Extract<ContentSegment, { type: 'link' }>): string {
  if (segment.resolutionStatus === 'resolved') {
    return `Open ${label}`;
  }

  if (segment.resolutionStatus === 'ambiguous') {
    return `Choose destination for "${label}"`;
  }

  return `Create page "${label}"`;
}

function createElementForTag(
  tagName: string,
  props: { key: string; style: CSSProperties; [key: string]: unknown },
  children: ReactNode[]
): ReactNode {
  return createElement(tagName, props, ...children);
}

function getSafeStyle(element: HTMLElement): CSSProperties {
  const style: CSSProperties = {};
  const { backgroundColor, color, fontSize, fontStyle, fontWeight, textDecorationLine } = element.style;

  if (isSafeCssValue(backgroundColor)) {
    style.backgroundColor = backgroundColor;
  }

  if (isSafeCssValue(color)) {
    style.color = color;
  }

  if (isSafeCssValue(fontSize)) {
    style.fontSize = fontSize;
  }

  if (isSafeCssValue(fontStyle)) {
    style.fontStyle = fontStyle;
  }

  if (isSafeCssValue(fontWeight)) {
    style.fontWeight = fontWeight;
  }

  if (isSafeCssValue(textDecorationLine)) {
    style.textDecorationLine = textDecorationLine;
  }

  return style;
}

function getSafeDataAttributes(element: HTMLElement): Record<string, string> {
  const attributes: Record<string, string> = {};

  if (element.dataset.listType === 'task') {
    attributes['data-list-type'] = 'task';
  }

  if (element.dataset.taskItem === 'true') {
    attributes['data-task-item'] = 'true';
  }

  if (element.dataset.checked === 'true' || element.dataset.checked === 'false') {
    attributes['data-checked'] = element.dataset.checked;
  }

  return attributes;
}

function isSafeCssValue(value: string): boolean {
  return value.length > 0 && !/url\s*\(|expression\s*\(/i.test(value);
}
