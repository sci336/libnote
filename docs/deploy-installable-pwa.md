# Deploy LibNote As An Installable App

LibNote is a Vite static app. To make it installable for normal users, build it and host the generated `dist/` folder on an HTTPS static host.

## Build

```bash
npm install
npm run build
```

The production files are written to `dist/`. The service worker and manifest are copied from `public/`.

## Host

Practical static hosting options include:

- Vercel
- Netlify
- GitHub Pages
- Cloudflare Pages
- Any static host that serves `dist/` over HTTPS

Normal PWA installation requires HTTPS. `localhost` is the development exception that browsers allow for testing.

## GitHub Pages Base Path

This repo currently uses `base: '/libnote/'` in `vite.config.ts`. That matches the configured GitHub Pages project URL:

```text
https://sci336.github.io/libnote/
```

The manifest uses relative `start_url` and `scope` values (`"."`) so installed launches remain under the current deployment path. The service worker is registered at `import.meta.env.BASE_URL`, so its scope follows the Vite base path.

If LibNote moves to a custom domain/root deployment or a different GitHub Pages project path, update `vite.config.ts` to match that final URL and then test the manifest, service worker, icons, offline reload, and installed start URL from the deployed site. Do not change the base path blindly.

## User Install Flow

After deployment, users should open the site once and install from their platform:

- Desktop Chrome or Edge: use the browser install button when available.
- iPhone or iPad: open in Safari, use Share, then Add to Home Screen.
- Android: use the browser menu or install prompt where supported.

After installation, LibNote opens from its icon. Users should not need npm commands, a dev server, or a terminal.

## Local-First Warning

LibNote stores data locally in browser/app storage. Installing the PWA does not create cloud backup, sync, or an account. Clearing site data can delete the library. Users should export backups regularly from App Menu -> Backup & Restore.
