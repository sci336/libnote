import { expect, type Locator, type Page, test } from '@playwright/test';

test.describe('mobile and narrow viewport flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await clearAppStorage(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Books', level: 1 })).toBeVisible();
    await expectSidebarClosed(page);
  });

  test('keeps sidebar off-canvas by default, closes after mobile navigation, and keeps Loose and Recent pages reachable', async ({
    page
  }) => {
    const names = {
      book: 'Mobile Sidebar Book',
      chapter: 'Mobile Sidebar Chapter',
      page: 'Mobile Sidebar Page'
    };

    await createNamedHierarchy(page, names);
    await createNamedLoosePage(page, 'Mobile Loose Reachable');
    await goToLibraryHome(page);
    await expectSidebarClosed(page);

    await openSidebar(page);
    await sidebar(page).getByRole('button', { name: names.book, exact: true }).click();
    await expect(page.getByRole('main').getByRole('button', { name: names.book, exact: true })).toBeVisible();
    await expectSidebarClosed(page);

    await openSidebar(page);
    await sidebar(page).getByRole('button', { name: names.chapter, exact: true }).click();
    await expect(page.getByRole('main').getByRole('button', { name: names.chapter, exact: true })).toBeVisible();
    await expectSidebarClosed(page);

    await openSidebar(page);
    await sidebar(page).getByRole('button', { name: names.page, exact: true }).click();
    await expect(page.getByLabel('Page content')).toBeVisible();
    await expectSidebarClosed(page);

    await openSidebar(page);
    await expect(sidebar(page).getByRole('button', { name: 'Loose Pages', exact: true })).toBeVisible();
    await sidebar(page).getByRole('button', { name: 'View All' }).click();
    await expect(page.getByRole('heading', { name: 'Loose Pages', level: 1 })).toBeVisible();
    await expect(page.locator('article').filter({ hasText: 'Mobile Loose Reachable' })).toBeVisible();
    await expectSidebarClosed(page);

    await openSidebar(page);
    await expect(sidebar(page).getByRole('button', { name: 'Recent Pages' })).toBeVisible();
    await sidebar(page).getByRole('button', { name: /Mobile Sidebar Page/ }).click();
    await expect(page.getByLabel('Page content')).toBeVisible();
    await expect(page.getByRole('main').getByRole('button', { name: names.page, exact: true })).toBeVisible();
    await expectSidebarClosed(page);
  });

  test('edits Lexical content with toolbar formatting and persists it after mobile reload', async ({ page }) => {
    const editor = await createNamedLoosePage(page, 'Mobile Editor Scratch');

    await editor.pressSequentially('Mobile persisted text ');
    await page.getByRole('button', { name: 'Bold' }).click();
    await editor.pressSequentially('bold text');
    await page.getByRole('button', { name: 'Bold' }).click();
    await editor.pressSequentially(' after bold.');

    await expect(editor).toContainText('Mobile persisted text bold text after bold.');
    await waitForStoredContent(page, /Mobile persisted text/);
    await waitForStoredContent(page, /<strong>bold text<\/strong>/);

    await page.reload();
    await openLoosePage(page, 'Mobile Editor Scratch');
    await expect(page.getByLabel('Page content')).toContainText('Mobile persisted text bold text after bold.');
  });

  test('supports wikilink autocomplete selection and safe dismissal on mobile', async ({ page }) => {
    await createNamedLoosePage(page, 'Mobile Wiki Target');
    const editor = await createNamedLoosePage(page, 'Mobile Wiki Scratch');

    await editor.pressSequentially('Connect [[Mob');
    const linkSuggestions = page.getByRole('listbox', { name: 'Page link suggestions' });
    await expect(linkSuggestions).toBeVisible();
    await linkSuggestions.getByRole('option', { name: /\[\[Mobile Wiki Target\]\]/ }).click();
    await expect(editor).toContainText('Connect [[Mobile Wiki Target]]');

    await editor.pressSequentially(' dismiss [[Mob');
    await expect(linkSuggestions).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(linkSuggestions).toBeHidden();

    await editor.pressSequentially(' tapaway [[Mob');
    await expect(linkSuggestions).toBeVisible();
    await page.getByRole('main').getByRole('button', { name: 'Mobile Wiki Scratch', exact: true }).click();
    await expect(linkSuggestions).toBeHidden();

    await waitForStoredContent(page, /\[\[Mobile Wiki Target\]\]/);
  });

  test('supports slash-tag autocomplete selection and safe dismissal on mobile', async ({ page }) => {
    await createNamedLoosePage(page, 'Mobile Tag Source', { tags: ['/mobile'] });
    const editor = await createNamedLoosePage(page, 'Mobile Tag Scratch');

    await editor.pressSequentially('Tag /mo');
    const tagSuggestions = page.getByRole('listbox', { name: 'Tag suggestions' });
    await expect(tagSuggestions).toBeVisible();
    await tagSuggestions.getByRole('option', { name: '/mobile' }).click();
    await expect(editor).toContainText('Tag /mobile');

    await editor.pressSequentially(' dismiss /mo');
    await expect(tagSuggestions).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tagSuggestions).toBeHidden();

    await editor.pressSequentially(' tapaway /mo');
    await expect(tagSuggestions).toBeVisible();
    await page.getByRole('main').getByRole('button', { name: 'Mobile Tag Scratch', exact: true }).click();
    await expect(tagSuggestions).toBeHidden();

    await waitForStoredContent(page, /\/mobile/);
  });
});

function sidebar(page: Page): Locator {
  return page.getByTestId('library-sidebar');
}

async function openSidebar(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Open library navigation' }).click();
  await expectSidebarOpen(page);
}

async function expectSidebarOpen(page: Page): Promise<void> {
  await expect.poll(() => isSidebarInViewport(page)).toBe(true);
}

async function expectSidebarClosed(page: Page): Promise<void> {
  await expect.poll(() => isSidebarInViewport(page)).toBe(false);
}

async function isSidebarInViewport(page: Page): Promise<boolean> {
  return sidebar(page).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.right > 0 && rect.left < window.innerWidth && rect.width > 0 && rect.height > 0;
  });
}

async function createNamedHierarchy(
  page: Page,
  names: { book: string; chapter: string; page: string }
): Promise<void> {
  await goToLibraryHome(page);
  await page.getByRole('main').getByRole('button', { name: /^(Create Book|New Book)$/ }).first().click();
  await renameVisibleTitle(page, 'Untitled Book', names.book);

  await page.getByRole('main').getByRole('button', { name: 'New Chapter' }).click();
  await renameVisibleTitle(page, 'Untitled Chapter', names.chapter);

  await page.getByRole('main').getByRole('button', { name: 'New Page' }).click();
  await renameVisibleTitle(page, 'Untitled Page', names.page);
  await expect(page.getByLabel('Page content')).toBeVisible();
}

async function createNamedLoosePage(
  page: Page,
  title: string,
  options: { tags?: string[] } = {}
): Promise<Locator> {
  await goToLibraryHome(page);
  await page.getByRole('main').getByRole('button', { name: 'Loose Pages' }).click();
  await page
    .getByRole('main')
    .getByRole('button', { name: /^(Create Loose Page|New Loose Page)$/ })
    .first()
    .click();
  await renameVisibleTitle(page, 'Untitled Loose Page', title);

  for (const tag of options.tags ?? []) {
    await page.getByLabel('Add tag').fill(tag);
    await page.getByLabel('Add tag').press('Enter');
  }

  const editor = page.getByLabel('Page content');
  await expect(editor).toBeVisible();
  await editor.click();
  return editor;
}

async function openLoosePage(page: Page, title: string): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Books', level: 1 })).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: 'Loose Pages' }).click();
  const card = page.locator('article').filter({ hasText: title });
  await card.getByRole('button', { name: 'Open' }).click();
  await expect(page.getByLabel('Page content')).toBeVisible();
}

async function renameVisibleTitle(page: Page, currentTitle: string, nextTitle: string): Promise<void> {
  await page.getByRole('main').getByRole('button', { name: currentTitle, exact: true }).click();
  await page.getByLabel('Edit title').fill(nextTitle);
  await page.getByLabel('Edit title').press('Enter');
  await expect(page.getByRole('main').getByRole('button', { name: nextTitle, exact: true })).toBeVisible();
}

async function goToLibraryHome(page: Page): Promise<void> {
  const homeButton = page.getByRole('button', { name: 'Go to library home' });
  if (await homeButton.isVisible()) {
    await homeButton.click();
  }
  await expect(page.getByRole('heading', { name: 'Books', level: 1 })).toBeVisible();
}

async function clearAppStorage(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('note-library-db');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => resolve();
    });
  });
}

async function waitForStoredContent(page: Page, pattern: RegExp): Promise<void> {
  await expect
    .poll(async () => {
      const pages = await getStoredPages(page);
      return pages.some((storedPage) => pattern.test(storedPage.content));
    })
    .toBe(true);
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
