import { describe, expect, it } from 'vitest';
import {
  createBackupPayload,
  createPageExportFile,
  validateBackupPayload
} from './backup';
import { DEFAULT_APP_SETTINGS } from './appSettings';
import {
  createLibNoteLexicalEditor,
  lexicalEditorToHtml,
  lexicalEditorToPlainText,
  loadHtmlIntoLexicalEditor,
  sanitizeClipboardToHtml
} from './lexicalRichText';
import { contentToPlainText } from './richText';
import { buildSearchIndex, searchPages } from './search';
import { extractBracketLinks } from './pageLinks';
import { parseTagQuery } from './tags';
import type { LibraryData } from '../types/domain';

describe('lexical rich text editor compatibility', () => {
  it('serializes bold text to compatible HTML', async () => {
    const html = await roundTripHtml('<p>Hello <strong>bold</strong></p>');

    expect(html).toContain('<strong');
    expect(contentToPlainText(html)).toBe('Hello bold');
  });

  it('serializes italic text to compatible HTML', async () => {
    const html = await roundTripHtml('<p>Hello <em>italic</em></p>');

    expect(html).toContain('<em');
    expect(contentToPlainText(html)).toBe('Hello italic');
  });

  it('serializes underline text to compatible HTML', async () => {
    const html = await roundTripHtml('<p>Hello <u>under</u></p>');

    expect(html).toContain('<u>');
    expect(contentToPlainText(html)).toBe('Hello under');
  });

  it('serializes highlighted text to safe readable HTML', async () => {
    const html = await roundTripHtml('<p>Hello <mark>marked</mark></p>');

    expect(html).toContain('<mark>');
    expect(contentToPlainText(html)).toBe('Hello marked');
  });

  it('loads legacy background highlight markup and normalizes it to mark', async () => {
    const html = await roundTripHtml('<p>Hello <span style="background-color: rgb(255, 243, 163);">marked</span></p>');

    expect(html).toContain('<mark>');
    expect(contentToPlainText(html)).toBe('Hello marked');
  });

  it('serializes headings to compatible HTML', async () => {
    const html = await roundTripHtml('<h2>Chapter Notes</h2>');

    expect(html).toBe('<h2>Chapter Notes</h2>');
    expect(contentToPlainText(html)).toBe('Chapter Notes');
  });

  it('serializes bullet lists for search and txt export', async () => {
    const html = await roundTripHtml('<ul><li>Bullet one</li><li>Bullet two</li></ul>');
    const plainText = contentToPlainText(html);

    expect(html).toContain('<ul>');
    expect(plainText).toContain('- Bullet one');
  });

  it('serializes numbered lists for search and txt export', async () => {
    const html = await roundTripHtml('<ol><li>First</li><li>Second</li></ol>');
    const plainText = contentToPlainText(html);

    expect(html).toContain('<ol>');
    expect(plainText).toContain('1. First');
  });

  it('preserves nested lists when existing editor HTML is loaded and saved', async () => {
    const html = await roundTripHtml('<ul><li>Parent<ul><li>Nested</li></ul></li><li>Sibling</li></ul>');

    expect(html).toContain('<ul><li>Parent<ul><li>Nested</li></ul></li><li>Sibling</li></ul>');
    expect(contentToPlainText(html)).toBe('- Parent\n  - Nested\n- Sibling');
  });

  it('preserves nested pasted lists after sanitization and Lexical import', async () => {
    const pastedHtml = sanitizeClipboardToHtml(
      '<div><ul class="foreign"><li style="color:red">Parent<ul><li><b>Nested</b></li></ul></li></ul></div>',
      ''
    );
    const html = await roundTripHtml(pastedHtml);

    expect(pastedHtml).toBe('<ul><li>Parent<ul><li><strong>Nested</strong></li></ul></li></ul>');
    expect(html).toContain('<ul><li>Parent<ul><li><strong>Nested</strong></li></ul></li></ul>');
    expect(contentToPlainText(html)).toBe('- Parent\n  - Nested');
  });

  it('serializes task lists in the current editor-compatible HTML shape', async () => {
    const html = await roundTripHtml(
      '<ul data-list-type="task"><li data-task-item="true" data-checked="true">Done</li><li data-task-item="true" data-checked="false">Todo</li></ul>'
    );

    expect(html).toContain('<ul data-list-type="task">');
    expect(html).toContain('data-checked="true"');
    expect(contentToPlainText(html)).toBe('- [x] Done\n- [ ] Todo');
  });

  it('keeps wikilinks and slash tags detectable after Lexical serialization', async () => {
    const html = await roundTripHtml('<p>See [[Athena Notes]] for /mythology context.</p>');

    expect(extractBracketLinks(html)).toEqual(['Athena Notes']);
    expect(parseTagQuery('/mythology')).toEqual(['mythology']);
    expect(contentToPlainText(html)).toContain('/mythology');
  });

  it('extracts plain text readably after autocomplete-style wikilinks and slash tags', async () => {
    const html = await roundTripHtml('<p>Review [[History Notes]] with /history.</p>');

    expect(contentToPlainText(html)).toBe('Review [[History Notes]] with /history.');
    expect(extractBracketLinks(html)).toEqual(['History Notes']);
  });

  it('keeps search, backup, restore, and txt export compatible with Lexical HTML', async () => {
    const content = await roundTripHtml('<p>Searchable [[Athena]] content with /research tag.</p>');
    const data = buildLibraryData(content);
    const index = buildSearchIndex(data);

    expect(searchPages('searchable', index).map((result) => result.id)).toContain('page-1');

    const payload = createBackupPayload(data, DEFAULT_APP_SETTINGS);
    const validated = validateBackupPayload(payload);
    expect(validated.data.pages[0].content).toBe(content);

    const exportFile = createPageExportFile(validated.data.pages[0]);
    expect(exportFile.content).toContain('Searchable [[Athena]] content with /research tag.');
  });

  it('sanitizes pasted rich text before Lexical import', () => {
    expect(
      sanitizeClipboardToHtml(
        '<div style="color:red"><script>alert("x")</script><b>Safe</b> [[Link]] /tag</div>',
        ''
      )
    ).toBe('<p><strong>Safe</strong> [[Link]] /tag</p>');
  });

  it('keeps useful Google Docs style formatting without importing classes or styles', async () => {
    const pastedHtml = sanitizeClipboardToHtml(
      '<meta charset="utf-8"><p class="docs-paragraph" style="line-height:1.38"><span style="font-weight:700">Bold</span> <span style="font-style:italic">Italic</span> <span style="text-decoration:underline">Under</span> <span style="background-color:rgb(255, 242, 204)">Mark</span></p>',
      ''
    );
    const html = await roundTripHtml(pastedHtml);

    expect(pastedHtml).toBe('<p><strong>Bold</strong> <em>Italic</em> <u>Under</u> <mark>Mark</mark></p>');
    expect(html).toBe('<p><strong>Bold</strong> <em>Italic</em> <u>Under</u> <mark>Mark</mark></p>');
    expect(html).not.toContain('class=');
    expect(html).not.toContain('style=');
  });

  it('converts Word-like list paragraphs into nested compatible lists', async () => {
    const pastedHtml = sanitizeClipboardToHtml(
      [
        '<p class="MsoListParagraphCxSpFirst" style="mso-list:l0 level1 lfo1">',
        '<span style="mso-list:Ignore">1.<span>&nbsp;&nbsp;</span></span>Parent',
        '</p>',
        '<p class="MsoListParagraphCxSpMiddle" style="mso-list:l0 level2 lfo1">',
        '<span style="mso-list:Ignore">a.<span>&nbsp;&nbsp;</span></span><b>Nested</b>',
        '</p>',
        '<p class="MsoListParagraphCxSpLast" style="mso-list:l0 level1 lfo1">',
        '<span style="mso-list:Ignore">2.<span>&nbsp;&nbsp;</span></span>Sibling',
        '</p>'
      ].join(''),
      ''
    );
    const html = await roundTripHtml(pastedHtml);

    expect(pastedHtml).toBe('<ol><li>Parent<ol><li><strong>Nested</strong></li></ol></li><li>Sibling</li></ol>');
    expect(html).toBe('<ol><li>Parent<ol><li><strong>Nested</strong></li></ol></li><li>Sibling</li></ol>');
    expect(contentToPlainText(html)).toBe('1. Parent\n  1. Nested\n2. Sibling');
  });

  it('uses plain text clipboard data when HTML is unavailable', () => {
    expect(sanitizeClipboardToHtml('', 'Line one\nLine <two>')).toBe('Line one<br>Line &lt;two&gt;');
  });

  it('preserves text size styling scoped to individual spans', async () => {
    const html = await roundTripHtml(
      '<p>Normal <span style="font-size: 1.5rem">large text</span> and normal again</p>'
    );

    expect(html).toContain('font-size: 1.5rem');
    expect(html).toContain('Normal');
    expect(html).toContain('normal again');
    expect(contentToPlainText(html)).toBe('Normal large text and normal again');
  });

  it('round-trips underlined text through serialization', async () => {
    const html = await roundTripHtml('<p>Some <u>underlined</u> text</p>');

    expect(html).toContain('<u>underlined</u>');
    expect(contentToPlainText(html)).toBe('Some underlined text');
  });

  it('round-trips checklist items with checked state', async () => {
    const html = await roundTripHtml(
      '<ul data-list-type="task"><li data-task-item="true" data-checked="true">Done item</li><li data-task-item="true" data-checked="false">Pending item</li></ul>'
    );

    expect(html).toContain('data-list-type="task"');
    expect(html).toContain('data-checked="true"');
    expect(html).toContain('data-checked="false"');
    expect(html).toContain('Done item');
    expect(html).toContain('Pending item');
  });

  it('preserves mixed formatting: underlined large text in a checklist item', async () => {
    const html = await roundTripHtml(
      '<ul data-list-type="task"><li data-task-item="true" data-checked="false"><u><span style="font-size: 1.25rem">Important task</span></u></li></ul>'
    );

    expect(html).toContain('<u>');
    expect(html).toContain('font-size: 1.25rem');
    expect(html).toContain('data-list-type="task"');
    expect(contentToPlainText(html)).toContain('Important task');
  });

  it('does not apply text size globally when only part of content has sizing', async () => {
    const html = await roundTripHtml(
      '<p>Normal text</p><p><span style="font-size: 2rem">Huge text</span></p><p>Also normal</p>'
    );

    const paragraphs = html.split('</p>').filter((p) => p.includes('<p>'));
    expect(paragraphs[0]).not.toContain('font-size');
    expect(paragraphs[1]).toContain('font-size: 2rem');
    expect(paragraphs[2]).not.toContain('font-size');
  });
});

function roundTripHtml(content: string): Promise<string> {
  const editor = createLibNoteLexicalEditor();

  return new Promise((resolve) => {
    editor.update(
      () => {
        loadHtmlIntoLexicalEditor(editor, content);
      },
      {
        discrete: true,
        onUpdate: () => {
          editor.getEditorState().read(() => {
            const text = lexicalEditorToPlainText();
            expect(text.length).toBeGreaterThan(0);
            resolve(lexicalEditorToHtml(editor));
          });
        }
      }
    );
  });
}

function buildLibraryData(content: string): LibraryData {
  return {
    books: [
      {
        id: 'book-1',
        title: 'Book',
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z'
      }
    ],
    chapters: [
      {
        id: 'chapter-1',
        bookId: 'book-1',
        title: 'Chapter',
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z'
      }
    ],
    pages: [
      {
        id: 'page-1',
        chapterId: 'chapter-1',
        title: 'Page',
        content,
        tags: ['research'],
        textSize: 16,
        isLoose: false,
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z'
      }
    ]
  };
}
