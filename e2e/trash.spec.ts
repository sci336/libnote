import { expect, type Locator, type Page, test } from '@playwright/test';

test.describe('Trash data-safety flows', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppStorage(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Books', level: 1 })).toBeVisible();
  });

  test('restores a trashed book with its nested chapter and page', async ({ page }) => {
    const names = {
      book: 'Trash Cascade Book',
      chapter: 'Trash Cascade Chapter',
      page: 'Trash Cascade Page'
    };

    await createNamedHierarchy(page, names);
    await goToLibraryHome(page);
    await moveBookToTrashFromRoot(page, names.book);

    await expect(page.getByRole('heading', { name: 'Books', level: 1 })).toBeVisible();
    await expect(page.getByRole('main').getByRole('button', { name: `Open ${names.book}`, exact: true })).toHaveCount(0);
    await expectNormalSearchHasNoMatch(page, names.chapter);
    await expectNormalSearchHasNoMatch(page, names.page);

    await openTrash(page);
    await expectTrashCard(page, names.book, 'Book', 'From Library');
    await expectTrashCard(page, names.chapter, 'Chapter', `From ${names.book}`);
    await expectTrashCard(page, names.page, 'Page', `From ${names.book} / ${names.chapter}`);

    await trashCard(page, names.book).getByRole('button', { name: `Restore ${names.book} from Trash` }).click();
    await expect(page.getByRole('heading', { name: 'Trash is empty' })).toBeVisible();

    await goToLibraryHome(page);
    await openBookFromRoot(page, names.book);
    await expect(page.locator('article').filter({ hasText: names.chapter })).toBeVisible();
    await openChapterFromBook(page, names.chapter);
    await expect(page.locator('article').filter({ hasText: names.page })).toBeVisible();
  });

  test('restores a page-level Trash item to its original chapter', async ({ page }) => {
    const names = {
      book: 'Page Restore Book',
      chapter: 'Page Restore Chapter',
      page: 'Page Restore Target'
    };

    await createNamedHierarchy(page, names);
    await moveActivePageToTrash(page, names.page);

    await expect(page.getByRole('main').getByRole('button', { name: names.chapter, exact: true })).toBeVisible();
    await expect(page.locator('article').filter({ hasText: names.page })).toHaveCount(0);

    await goToLibraryHome(page);
    await openBookFromRoot(page, names.book);
    await expect(page.locator('article').filter({ hasText: names.chapter })).toBeVisible();

    await openTrash(page);
    await expectTrashCard(page, names.page, 'Page', `From ${names.book} / ${names.chapter}`);
    await trashCard(page, names.page).getByRole('button', { name: `Restore ${names.page} from Trash` }).click();
    await expect(page.getByRole('heading', { name: 'Trash is empty' })).toBeVisible();

    await goToLibraryHome(page);
    await openBookFromRoot(page, names.book);
    await openChapterFromBook(page, names.chapter);
    await expect(page.locator('article').filter({ hasText: names.page })).toBeVisible();
  });

  test('deletes a selected page forever without breaking navigation', async ({ page }) => {
    const names = {
      book: 'Forever Delete Book',
      chapter: 'Forever Delete Chapter',
      page: 'Forever Delete Page'
    };

    await createNamedHierarchy(page, names);
    await expect(page.getByRole('main').getByRole('button', { name: names.page, exact: true })).toBeVisible();
    await moveActivePageToTrash(page, names.page);

    await openTrash(page);
    await acceptDialogAndClick(
      page,
      trashCard(page, names.page).getByRole('button', {
        name: `Permanently delete ${names.page} from Trash. This cannot be undone.`
      }),
      `Delete "${names.page}" forever? This cannot be undone.`
    );

    await expect(page.getByRole('heading', { name: 'Trash is empty' })).toBeVisible();
    await goToLibraryHome(page);
    await openBookFromRoot(page, names.book);
    await openChapterFromBook(page, names.chapter);
    await expect(page.getByRole('main').getByRole('button', { name: names.chapter, exact: true })).toBeVisible();
    await expect(page.locator('article').filter({ hasText: names.page })).toHaveCount(0);
  });

  test('empties Trash while preserving live library data', async ({ page }) => {
    const keepNames = {
      book: 'Keep Live Book',
      chapter: 'Keep Live Chapter',
      page: 'Keep Live Page'
    };
    const firstLoosePage = 'Empty Trash Loose One';
    const secondLoosePage = 'Empty Trash Loose Two';

    await createNamedHierarchy(page, keepNames);
    await createNamedLoosePage(page, firstLoosePage);
    await moveActivePageToTrash(page, firstLoosePage);
    await createNamedLoosePage(page, secondLoosePage);
    await moveActivePageToTrash(page, secondLoosePage);

    await openTrash(page);
    await expectTrashCard(page, firstLoosePage, 'Loose Page', 'From Loose Pages');
    await expectTrashCard(page, secondLoosePage, 'Loose Page', 'From Loose Pages');

    await acceptDialogAndClick(
      page,
      page.getByRole('button', { name: 'Permanently delete every item in Trash' }),
      'Empty Trash? This will permanently delete all trashed items and cannot be undone.'
    );

    await expect(page.getByRole('heading', { name: 'Trash is empty' })).toBeVisible();
    await goToLibraryHome(page);
    await expect(page.getByRole('main').getByRole('button', { name: `Open ${keepNames.book}`, exact: true })).toBeVisible();
    await openBookFromRoot(page, keepNames.book);
    await openChapterFromBook(page, keepNames.chapter);
    await expect(page.locator('article').filter({ hasText: keepNames.page })).toBeVisible();
  });
});

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

async function createNamedLoosePage(page: Page, title: string): Promise<void> {
  await goToLibraryHome(page);
  await page.getByRole('main').getByRole('button', { name: 'Loose Pages' }).click();
  await page
    .getByRole('main')
    .getByRole('button', { name: /^(Create Loose Page|New Loose Page)$/ })
    .first()
    .click();
  await renameVisibleTitle(page, 'Untitled Loose Page', title);
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

async function openBookFromRoot(page: Page, title: string): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Books', level: 1 })).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: `Open ${title}`, exact: true }).click();
  await expect(page.getByRole('main').getByRole('button', { name: title, exact: true })).toBeVisible();
}

async function openChapterFromBook(page: Page, title: string): Promise<void> {
  const card = page.locator('article').filter({ hasText: title });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Open Chapter' }).click();
  await expect(page.getByRole('main').getByRole('button', { name: title, exact: true })).toBeVisible();
}

async function moveBookToTrashFromRoot(page: Page, title: string): Promise<void> {
  const card = page.locator('article').filter({ hasText: title });
  await expect(card).toBeVisible();
  await acceptDialogAndClick(
    page,
    card.getByRole('button', { name: `Move ${title} and all of its chapters and pages to Trash` }),
    `Move "${title}" and all of its chapters and pages to Trash? You can restore them from Trash.`
  );
}

async function moveActivePageToTrash(page: Page, title: string): Promise<void> {
  await acceptDialogAndClick(
    page,
    page.getByRole('main').getByRole('button', { name: 'Move to Trash' }),
    `Move "${title}" to Trash? You can restore it from Trash.`
  );
}

async function openTrash(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Open Trash' }).click();
  await expect(page.getByRole('heading', { name: 'Trash', level: 1 })).toBeVisible();
}

function trashCard(page: Page, title: string): Locator {
  return page.locator('article').filter({
    has: page.locator('.list-card-title').getByText(title, { exact: true })
  });
}

async function expectTrashCard(page: Page, title: string, typeLabel: string, locationLabel: string): Promise<void> {
  const card = trashCard(page, title);
  await expect(card).toBeVisible();
  await expect(card).toContainText(typeLabel);
  await expect(card).toContainText(locationLabel);
}

async function expectNormalSearchHasNoMatch(page: Page, query: string): Promise<void> {
  await page.getByLabel('Search books, chapters, pages, or slash tags').fill(query);
  await expect(page.getByRole('heading', { name: 'No matches found' })).toBeVisible();
  await page.getByLabel('Search books, chapters, pages, or slash tags').fill('');
  await goToLibraryHome(page);
}

async function acceptDialogAndClick(page: Page, trigger: Locator, expectedMessage: string): Promise<void> {
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toBe(expectedMessage);
    await dialog.accept();
  });
  await trigger.click();
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
