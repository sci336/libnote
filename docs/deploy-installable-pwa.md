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

This repo currently uses Vite's default root base path (`/`). That is correct for a custom domain or root deployment.

For a project site such as `https://USER.github.io/REPO/`, Vite usually needs a matching `base: '/REPO/'` configuration and the manifest/service-worker paths need to be checked against that subpath. Do not change the base path blindly: choose the final URL first, then test the manifest, service worker, icons, offline reload, and installed start URL from that exact deployed URL.

## User Install Flow

After deployment, users should open the site once and install from their platform:

- Desktop Chrome or Edge: use the browser install button when available.
- iPhone or iPad: open in Safari, use Share, then Add to Home Screen.
- Android: use the browser menu or install prompt where supported.

After installation, LibNote opens from its icon. Users should not need npm commands, a dev server, or a terminal.

## Local-First Warning

LibNote stores data locally in browser/app storage. Installing the PWA does not create cloud backup, sync, or an account. Clearing site data can delete the library. Users should export backups regularly from App Menu -> Backup & Restore.
