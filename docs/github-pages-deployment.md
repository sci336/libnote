# GitHub Pages Deployment

This repo is configured to deploy LibNote to GitHub Pages at:

```text
https://sci336.github.io/libnote/
```

The Vite `base` setting is `/libnote/` so built assets, the manifest, icons, and service worker resolve correctly from the GitHub Pages project path.

## One-Time GitHub Setup

1. Push this repo to `https://github.com/sci336/libnote`.
2. In GitHub, open Settings -> Pages.
3. Under Build and deployment, set Source to GitHub Actions.
4. Save the setting.

## Deploy

Deployment runs automatically on every push to `main`.

You can also trigger it manually:

1. Open the Actions tab.
2. Choose Deploy LibNote to GitHub Pages.
3. Choose Run workflow.

The workflow:

1. Installs dependencies with `npm ci`.
2. Runs `npm run typecheck`.
3. Runs `npm test`.
4. Builds with `npm run build`.
5. Publishes `dist/` to GitHub Pages.

## Verify

After the workflow succeeds:

1. Open `https://sci336.github.io/libnote/`.
2. Confirm the app opens to the Books view.
3. Confirm `https://sci336.github.io/libnote/manifest.webmanifest` loads.
4. Confirm `https://sci336.github.io/libnote/sw.js` loads.
5. In Chrome or Edge, check for the install button in the address bar or browser menu.
6. On iPhone or iPad, open the URL in Safari and use Share -> Add to Home Screen.

LibNote stores data locally in browser/app storage. Installing from GitHub Pages does not create cloud sync or backup, so export backups regularly.
