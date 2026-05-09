import { expect, type Locator, type Page, test } from '@playwright/test';

test.describe('default Lexical editor', () => {
  test.beforeEach(async ({ page }) => {
    await clearLibraryDatabase(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Books', level: 1 })).toBeVisible();
  });

  test('creates a loose page, saves plain text, restores it after navigation and reload, and keeps search previews readable', async ({
    page
  }) => {
    const editor = await createLoosePage(page);

    await editor.pressSequentially('Durable plain phrase with /research and [[Example Page]].');
    await expect(editor).toContainText('Durable plain phrase');
    await waitForStoredContent(page, /Durable plain phrase/);

    await page.getByRole('button', { name: 'Go to library home' }).click();
    await page.getByRole('main').getByRole('button', { name: 'Loose Pages' }).click();
    const previewCard = page.locator('article').filter({ hasText: 'Durable plain phrase' });
    await expect(previewCard).toBeVisible();
    await expect(previewCard).not.toContainText('<p>');
    await expect(previewCard).not.toContainText('<strong');

    await previewCard.getByRole('button', { name: 'Open' }).click();
    await expect(page.getByLabel('Page content')).toContainText('[[Example Page]]');

    await page.reload();
    await openFirstLoosePage(page);
    await expect(page.getByLabel('Page content')).toContainText('Durable plain phrase');
    await expect(page.getByLabel('Page content')).toContainText('/research');

    await page.getByLabel('Search books, chapters, pages, or slash tags').fill('research');
    await expect(page.getByRole('button', { name: /Durable plain phrase/ })).toBeVisible();
  });

  test('adds slash tags from keyboard submit paths without moving focus away', async ({ page }) => {
    await createLoosePage(page);

    const tagInput = page.getByLabel('Add tag');
    await expect(page.getByRole('button', { name: 'Create tag from input' })).toHaveCount(0);

    await tagInput.fill('school');
    await tagInput.press('Enter');
    await expect(page.getByRole('button', { name: 'Open tag filter for school' })).toBeVisible();
    await expect(tagInput).toHaveValue('');
    await expect(tagInput).toBeFocused();

    await tagInput.fill('/work');
    await tagInput.press('Enter');
    await expect(page.getByRole('button', { name: 'Open tag filter for work' })).toBeVisible();
    await expect(tagInput).toBeFocused();
    await expect(page.getByLabel('Text size')).not.toBeFocused();

    await tagInput.fill('   ');
    await tagInput.press('Enter');
    await expect(tagInput).toHaveValue('');
    await expect(tagInput).toBeFocused();
    await expect(page.getByRole('button', { name: /^Open tag filter for / })).toHaveCount(2);

    await tagInput.fill('school');
    await tagInput.press('Enter');
    await expect(page.getByRole('button', { name: 'Open tag filter for school' })).toHaveCount(1);
    await expect(tagInput).toHaveValue('');

    await tagInput.fill('quest');
    await tagInput.dispatchEvent('keydown', { key: 'Tab', code: 'Tab', bubbles: true, cancelable: true });
    await expect(page.getByRole('button', { name: 'Open tag filter for quest' })).toBeVisible();
    await expect(page.getByLabel('Text size')).not.toBeFocused();
  });

  test('persists selected and toggled inline formatting and updates toolbar active states from selection changes', async ({
    page
  }) => {
    const editor = await createLoosePage(page);

    await editor.pressSequentially('Bold selected text. ');
    await selectEditorText(page, 'Bold selected');
    await page.getByRole('button', { name: 'Bold' }).click();
    await expectPressed(page, 'Bold', true);

    await placeCaretAtEnd(page);
    await expectPressed(page, 'Bold', false);

    await toggleFormatAndType(page, 'Italic', 'Italic text. ');
    await toggleFormatAndType(page, 'Underline', 'Under text. ');
    await toggleFormatAndType(page, 'Highlight', 'Marked text. ');
    await editor.pressSequentially('Plain after mark.');

    await waitForStoredContent(page, /<strong>Bold selected<\/strong>/);
    await waitForStoredContent(page, /<em>Italic text\. <\/em>/);
    await waitForStoredContent(page, /<u>Under text\. <\/u>/);
    await waitForStoredContent(page, /<mark>Marked text\. <\/mark>Plain after mark\./);

    await page.reload();
    await openFirstLoosePage(page);
    const reloadedEditor = page.getByLabel('Page content');
    await expect(reloadedEditor).toContainText('Bold selected text.');
    await expect(reloadedEditor).toContainText('Plain after mark.');

    await selectEditorText(page, 'Bold selected');
    await expectPressed(page, 'Bold', true);
    await selectEditorText(page, 'Italic text');
    await expectPressed(page, 'Italic', true);
    await selectEditorText(page, 'Under text');
    await expectPressed(page, 'Underline', true);
    await selectEditorText(page, 'Marked text');
    await expectPressed(page, 'Highlight', true);

    await placeCaretAfterText(page, 'Plain after mark');
    await expectPressed(page, 'Underline', false);
    await expectPressed(page, 'Highlight', false);
  });

  test('persists headings and list Enter behavior with active toolbar state coverage', async ({ page }) => {
    const editor = await createLoosePage(page);

    await editor.pressSequentially('Editor Reliability Heading');
    await selectEditorText(page, 'Editor Reliability Heading');
    await page.getByRole('button', { name: 'Heading' }).click();
    await expectPressed(page, 'Heading', true);
    await placeCaretAfterText(page, 'Editor Reliability Heading');
    await page.keyboard.press('Enter');
    await expectPressed(page, 'Heading', false);

    await page.getByRole('button', { name: 'Bullet list' }).click();
    await expectPressed(page, 'Bullet list', true);
    await editor.pressSequentially('Bullet one');
    await page.keyboard.press('Enter');
    await editor.pressSequentially('Bullet two');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await expectPressed(page, 'Bullet list', false);

    await page.getByRole('button', { name: 'Numbered list' }).click();
    await expectPressed(page, 'Numbered list', true);
    await editor.pressSequentially('First numbered');
    await page.keyboard.press('Enter');
    await editor.pressSequentially('Second numbered');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await expectPressed(page, 'Numbered list', false);

    await editor.pressSequentially('After lists.');
    await waitForStoredContent(page, /<h2>Editor Reliability Heading<\/h2>/);
    await waitForStoredContent(page, /<ul><li>Bullet one<\/li><li>Bullet two<\/li><\/ul>/);
    await waitForStoredContent(page, /<ol><li>First numbered<\/li><li>Second numbered<\/li><\/ol>/);

    await page.reload();
    await openFirstLoosePage(page);
    await expect(page.getByLabel('Page content')).toContainText('Editor Reliability Heading');
    await expect(page.getByLabel('Page content')).toContainText('Bullet one');
    await expect(page.getByLabel('Page content')).toContainText('Second numbered');

    await selectEditorText(page, 'Editor Reliability Heading');
    await expectPressed(page, 'Heading', true);
    await selectEditorText(page, 'Bullet one');
    await expectPressed(page, 'Bullet list', true);
    await selectEditorText(page, 'First numbered');
    await expectPressed(page, 'Numbered list', true);
  });

  test('scopes text size changes to the selected text and preserves neighboring content', async ({ page }) => {
    const editor = await createLoosePage(page);

    await editor.pressSequentially('Normal first. Sized target. Normal last.');
    await selectEditorText(page, 'Sized target');
    await page.getByLabel('Text size').selectOption('large');
    await expect(page.getByLabel('Text size')).toHaveValue('large');

    await selectEditorText(page, 'Normal first');
    await expect(page.getByLabel('Text size')).toHaveValue('normal');

    await waitForStoredContent(page, /<span style="font-size: 1\.25rem;?">Sized target<\/span>/);
    await expect
      .poll(async () => {
        const [storedPage] = await getStoredPages(page);
        return storedPage?.content ?? '';
      })
      .toMatch(/^<p>Normal first\. <span style="font-size: 1\.25rem;?">Sized target<\/span>\. Normal last\.<\/p>$/);

    await page.reload();
    await openFirstLoosePage(page);
    await expect(page.getByLabel('Page content')).toContainText('Normal first. Sized target. Normal last.');
    await selectEditorText(page, 'Sized target');
    await expect(page.getByLabel('Text size')).toHaveValue('large');
  });

  test('creates, saves, reloads, and restores checklist items as task list content', async ({ page }) => {
    const editor = await createLoosePage(page);

    await page.getByRole('button', { name: 'Checkbox list' }).click();
    await expectPressed(page, 'Checkbox list', true);
    await editor.pressSequentially('Pack fixtures');
    await page.keyboard.press('Enter');
    await editor.pressSequentially('Run smoke test');

    const checklist = page.locator('.lexical-rich-text ul.lexical-checklist');
    await expect(checklist).toBeVisible();
    await expect(checklist.locator('li.lexical-listitem-unchecked')).toHaveCount(2);
    await waitForStoredContent(page, /<ul data-list-type="task">/);
    await waitForStoredContent(page, /<li data-task-item="true" data-checked="false">Pack fixtures<\/li>/);

    await page.reload();
    await openFirstLoosePage(page);
    const reloadedChecklist = page.locator('.lexical-rich-text ul.lexical-checklist');
    await expect(reloadedChecklist).toBeVisible();
    await expect(reloadedChecklist.locator('li.lexical-listitem-unchecked')).toHaveCount(2);
    await selectEditorText(page, 'Pack fixtures');
    await expectPressed(page, 'Checkbox list', true);
  });

  test('sanitizes rich paste from external sources and persists compatible markup', async ({ page }) => {
    const editor = await createLoosePage(page);

    await pasteIntoEditor(
      page,
      '<meta charset="utf-8"><p class="docs" style="color:red"><span style="font-weight:700">Pasted bold</span> <span style="text-decoration:underline">under</span> <span style="background-color:rgb(255, 242, 204)">mark</span><script>bad()</script></p>',
      'Pasted bold under mark'
    );

    await expect(editor).toContainText('Pasted bold under mark');
    await waitForStoredContent(page, /<p><strong>Pasted bold<\/strong> <u>under<\/u> <mark>mark<\/mark><\/p>/);
    await expect
      .poll(async () => {
        const [storedPage] = await getStoredPages(page);
        return storedPage?.content ?? '';
      })
      .not.toMatch(/script|class=|color:red/);
  });

  test('inserts page and tag autocomplete suggestions and safely dismisses popovers', async ({ page }) => {
    await createNamedLoosePage(page, 'Atlas Notes', { tags: ['/research'] });
    const editor = await createNamedLoosePage(page, 'Autocomplete Scratch');

    await editor.pressSequentially('See [[At');
    const linkSuggestions = page.getByRole('listbox', { name: 'Page link suggestions' });
    await expect(linkSuggestions).toBeVisible();
    await linkSuggestions.getByRole('option', { name: /\[\[Atlas Notes\]\]/ }).click();
    await expect(editor).toContainText('See [[Atlas Notes]]');

    await editor.pressSequentially(' and /re');
    const tagSuggestions = page.getByRole('listbox', { name: 'Tag suggestions' });
    await expect(tagSuggestions).toBeVisible();
    await tagSuggestions.getByRole('option', { name: '/research' }).click();
    await expect(editor).toContainText('and /research');

    await editor.pressSequentially(' dismiss [[At');
    await expect(linkSuggestions).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(linkSuggestions).toBeHidden();

    await editor.pressSequentially(']]');
    await editor.pressSequentially(' outside /re');
    await expect(tagSuggestions).toBeVisible();
    await page.getByRole('main').getByRole('button', { name: 'Autocomplete Scratch' }).click();
    await expect(tagSuggestions).toBeHidden();

    await waitForStoredContent(page, /\[\[Atlas Notes\]\]/);
    await waitForStoredContent(page, /\/research/);
  });

  test('keeps the default editor usable on a narrow mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Books', level: 1 })).toBeVisible();

    await createNamedLoosePage(page, 'Mobile Target', { tags: ['/mobile'] });
    const editor = await createNamedLoosePage(page, 'Mobile Scratch');

    await editor.pressSequentially('Mobile body ');
    await page.getByRole('button', { name: 'Bold' }).click();
    await editor.pressSequentially('bold');
    await page.getByRole('button', { name: 'Bold' }).click();
    await editor.pressSequentially(' [[Mob');
    await expect(page.getByRole('listbox', { name: 'Page link suggestions' })).toBeVisible();
    await page.getByRole('option', { name: /\[\[Mobile Target\]\]/ }).click();
    await expect(editor).toContainText('Mobile body bold [[Mobile Target]]');

    await waitForStoredContent(page, /<strong>bold<\/strong>/);
    await waitForStoredContent(page, /\[\[Mobile Target\]\]/);
    await page.reload();
    await openFirstLoosePage(page, 'Mobile Scratch');
    await expect(page.getByLabel('Page content')).toContainText('Mobile body bold [[Mobile Target]]');
  });
});

async function createLoosePage(page: Page): Promise<Locator> {
  await page.getByRole('main').getByRole('button', { name: 'Loose Pages' }).click();
  await page
    .getByRole('main')
    .getByRole('button', { name: /^(Create Loose Page|New Loose Page)$/ })
    .first()
    .click();
  const editor = page.getByLabel('Page content');
  await expect(editor).toBeVisible();
  await editor.click();
  return editor;
}

async function createNamedLoosePage(
  page: Page,
  title: string,
  options: { tags?: string[] } = {}
): Promise<Locator> {
  await goToLibraryHome(page);
  const editor = await createLoosePage(page);
  await renameActivePage(page, title);

  for (const tag of options.tags ?? []) {
    await page.getByLabel('Add tag').fill(tag);
    await page.getByLabel('Add tag').press('Enter');
  }

  await editor.click();
  return editor;
}

async function renameActivePage(page: Page, title: string): Promise<void> {
  await page.getByRole('main').getByRole('button', { name: /^Untitled (Loose )?Page$/ }).click();
  await page.getByLabel('Edit title').fill(title);
  await page.getByLabel('Edit title').press('Enter');
  await expect(page.getByRole('main').getByRole('button', { name: title })).toBeVisible();
}

async function goToLibraryHome(page: Page): Promise<void> {
  const homeButton = page.getByRole('button', { name: 'Go to library home' });
  if (await homeButton.isVisible()) {
    await homeButton.click();
  }
  await expect(page.getByRole('heading', { name: 'Books', level: 1 })).toBeVisible();
}

async function openFirstLoosePage(page: Page, title?: string): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Books', level: 1 })).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: 'Loose Pages' }).click();
  const card = title ? page.locator('article').filter({ hasText: title }) : page.locator('article').first();
  await card.getByRole('button', { name: 'Open' }).click();
  await expect(page.getByLabel('Page content')).toBeVisible();
}

async function toggleFormatAndType(page: Page, label: string, text: string): Promise<void> {
  await page.getByRole('button', { name: label }).click();
  await expectPressed(page, label, true);
  await page.getByLabel('Page content').pressSequentially(text);
  await page.getByRole('button', { name: label }).click();
  await expectPressed(page, label, false);
}

async function expectPressed(page: Page, label: string, pressed: boolean): Promise<void> {
  const button = page.getByRole('button', { name: label });
  if (pressed) {
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    return;
  }

  await expect(button).not.toHaveAttribute('aria-pressed', 'true');
}

async function waitForStoredContent(page: Page, pattern: RegExp): Promise<void> {
  await expect
    .poll(async () => {
      const pages = await getStoredPages(page);
      return pages.some((storedPage) => pattern.test(storedPage.content));
    })
    .toBe(true);
}

async function clearLibraryDatabase(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('note-library-db');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => resolve();
    });
  });
}

async function getStoredPages(page: Page): Promise<Array<{ content: string }>> {
  return page.evaluate(() => {
    return new Promise<Array<{ content: string }>>((resolve, reject) => {
      const request = indexedDB.open('note-library-db', 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction('app-state', 'readonly');
        const storedRequest = transaction.objectStore('app-state').get('library');

        storedRequest.onerror = () => reject(storedRequest.error);
        storedRequest.onsuccess = () => {
          const snapshot = storedRequest.result as { pages?: Array<{ content: string }> } | undefined;
          resolve(snapshot?.pages ?? []);
          db.close();
        };
      };
    });
  });
}

async function pasteIntoEditor(page: Page, html: string, text: string): Promise<void> {
  await page.getByLabel('Page content').evaluate(
    (editor, payload) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/html', payload.html);
      clipboardData.setData('text/plain', payload.text);
      const event = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData
      });
      editor.dispatchEvent(event);
    },
    { html, text }
  );
}

async function selectEditorText(page: Page, text: string): Promise<void> {
  await setEditorSelection(page, text, 0, text.length);
}

async function placeCaretAfterText(page: Page, text: string): Promise<void> {
  await setEditorSelection(page, text, text.length, text.length);
}

async function placeCaretAtEnd(page: Page): Promise<void> {
  await page.getByLabel('Page content').evaluate((editor) => {
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    (editor as HTMLElement).focus();
    document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
  });
}

async function setEditorSelection(page: Page, text: string, startOffset: number, endOffset: number): Promise<void> {
  await page.getByLabel('Page content').evaluate(
    (editor, selection) => {
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
      let current = walker.nextNode();

      while (current) {
        const value = current.textContent ?? '';
        const index = value.indexOf(selection.text);
        if (index !== -1) {
          const range = document.createRange();
          range.setStart(current, index + selection.startOffset);
          range.setEnd(current, index + selection.endOffset);
          const windowSelection = window.getSelection();
          windowSelection?.removeAllRanges();
          windowSelection?.addRange(range);
          (editor as HTMLElement).focus();
          document.dispatchEvent(new Event('selectionchange', { bubbles: true }));
          return;
        }

        current = walker.nextNode();
      }

      throw new Error(`Could not find editor text: ${selection.text}`);
    },
    { text, startOffset, endOffset }
  );
}
