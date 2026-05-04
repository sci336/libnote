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

describe('lexical rich text prototype compatibility', () => {
  it('loads existing HTML and exports compatible HTML and plain text', async () => {
    const html = await roundTripHtml('<p>Hello <strong>bold</strong> <em>italic</em> <u>under</u></p>');

    expect(html).toContain('<strong');
    expect(html).toContain('<em');
    expect(html).toContain('<u>');
    expect(contentToPlainText(html)).toBe('Hello bold italic under');
  });

  it('preserves bullet and numbered list serialization for search and txt export', async () => {
    const html = await roundTripHtml('<ul><li>Bullet one</li><li>Bullet two</li></ul><ol><li>First</li><li>Second</li></ol>');
    const plainText = contentToPlainText(html);

    expect(html).toContain('<ul>');
    expect(html).toContain('<ol>');
    expect(plainText).toContain('- Bullet one');
    expect(plainText).toContain('1. First');
  });

  it('keeps wikilinks and slash tags detectable after Lexical serialization', async () => {
    const html = await roundTripHtml('<p>See [[Athena Notes]] for /mythology context.</p>');

    expect(extractBracketLinks(html)).toEqual(['Athena Notes']);
    expect(parseTagQuery('/mythology')).toEqual(['mythology']);
    expect(contentToPlainText(html)).toContain('/mythology');
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
