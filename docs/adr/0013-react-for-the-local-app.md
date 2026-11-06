# 0013: The local app moves to React and TypeScript

Status: Accepted

## Decision

The AFK local web app is rebuilt with React 19 and TypeScript, bundled by Vite into static
files that ship inside the package. AFK's design tokens stay plain CSS custom properties;
there is no Tailwind. The redesign in [the app redesign brief](../specs/afk-app-redesign/brief.md)
is built in this stack.

- **Built at package time.** Users install no React and run no build; the server keeps serving
  static files and injecting the session token into `index.html`.
- **Expand, then switch.** The new app is served at `/next/` while it grows; one final change
  serves it at `/` and deletes the string-template UI and its tests.
- **Typed operations.** The app talks to AFK through a typed client over the existing
  operations; no new server API shape is introduced for the UI.

## Reason

The redesign rewrites nearly every screen, so this is the cheapest moment to change stack.
The string-template UI made consistency hard to keep and its tests ran markup in `node:vm`
rather than as components. React and TypeScript match the owner's standard for web apps,
and the cost to users is small: about 60 KB compressed added to roughly 1.4 MB of web files,
most of which are fonts.

## Consequences

- A Vite build step joins the package build; the published files include the built app.
- UI tests move to Vitest with React Testing Library.
- During the switch-over period two UIs exist; only `/` is supported for daily use.
