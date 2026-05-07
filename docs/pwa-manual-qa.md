# PWA Manual QA

Use a production build or deployed site for this checklist. Vite development mode unregisters LibNote service workers on purpose, so install/offline behavior should not be judged from `npm run dev`.

## Production Build

1. Run `npm run build`.
2. Run `npm run preview`.
3. Open the preview URL and confirm LibNote loads to the Books view.
4. Confirm the manifest is detected with `LibNote`, `start_url: /`, `scope: /`, `display: standalone`, theme/background colors, and 192/512 PNG icons.
5. Confirm `sw.js` is registered on the production preview or deployed site.

## Desktop Install

1. Open the deployed HTTPS site in Chrome or Edge.
2. Use the browser install button in the address bar or app menu when available.
3. Launch LibNote from the installed app icon.
4. Confirm it opens at the Books view without requiring npm, a terminal, or a visible browser tab.
5. Confirm the App Menu help section explains Install LibNote and backup expectations.

## Mobile Safari Install

1. Open the deployed HTTPS site in Safari on iPhone or iPad.
2. Use Share -> Add to Home Screen.
3. Launch LibNote from the home screen icon.
4. Confirm the title/icon are LibNote and the app opens to the Books view.
5. Confirm iOS uses Add to Home Screen rather than a browser install prompt.

## Android Install

1. Open the deployed HTTPS site in Chrome or another PWA-capable Android browser.
2. Use the install prompt or browser menu when offered.
3. Launch LibNote from the installed icon.
4. Confirm browser chrome is minimized where the platform supports installed web apps.

## Offline Reload

1. Load LibNote once while online and wait for the service worker to register.
2. Create a disposable book, chapter, page, and loose page.
3. Wait for the Saved status.
4. Turn the device/browser offline.
5. Relaunch from the installed icon or reload the production preview.
6. Confirm the app shell opens and the offline indicator appears.
7. Confirm the local library data remains available.

## Update Available Flow

1. Install or load a production build.
2. Deploy or preview a newer build with a changed asset hash or updated `sw.js` cache name.
3. Reopen LibNote while online.
4. Confirm a subtle "A LibNote update is ready" message appears.
5. Type into a page before pressing Reload and confirm the app does not reload by surprise.
6. Press Reload after the page is saved.
7. Confirm LibNote reloads into the updated version.

## Backup Reminder And Persistence

1. Open App Menu -> Backup & Restore.
2. Confirm the backup reminder is visible.
3. Export a backup and keep it outside the browser profile.
4. Close and reopen the installed app.
5. Confirm local data persists after reopening.
6. In a disposable profile only, clear site data and confirm the library is removed, proving the warning is accurate.

## Notes

- Offline support means the app shell and local browser storage can work after the app has loaded once. It does not mean cloud sync.
- Installing LibNote does not create a cloud backup.
- Clearing site data, deleting the browser profile, or losing the device can delete the library unless the user exported a backup.
