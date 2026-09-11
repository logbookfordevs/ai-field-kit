# AI Field Kit Page

[Website](https://ai-field-kit.logbookfordevs.com/) · [Documentation](https://ai-field-kit.logbookfordevs.com/docs)

A React + TypeScript + Vite homepage and documentation site for [AI Field Kit](https://github.com/logbookfordevs/ai-field-kit), the portable rules, skills, workflows, and MCP setup for multi-agent developers.

## Quick Start

```bash
pnpm --dir apps/site install
pnpm site:dev
```

Use Node.js 24 or newer; the tests run TypeScript directly through Node.

The local app runs with Vite. The default development URL is:

```text
http://127.0.0.1:5173
```

## Build

```bash
pnpm site:build
```

## Documentation

Open `/docs` for the preview-first field manual. Chapters use URLs such as
`/docs?chapter=setup`; headings support ordinary fragment links. Content lives in
`src/docs/content/*.mdx`, with layout and reading styles in `src/docs`.
React Router owns page and chapter navigation, browser history, and scroll
restoration. Internal links use `SiteLink`, which retains the current chapter
query for section links and leaves downloads, Markdown, and external links native.
The docs route loads once on demand; chapter changes keep the docs shell mounted.

For Vercel, set the project's Root Directory to `apps/site`. The included
`vercel.json` rewrites `/docs` and `/docs/` to `index.html`, preserving chapter
query parameters. Redeploy after changing this configuration. Other hosts need
the same SPA fallback; Vite provides it during local development.

Check command examples against `packages/afk/src/cli.ts` and setup behavior
before updating the guide. Website validation does not require running setup
against a real agent configuration.

## Stack

- React + TypeScript (strict checking)
- React Router (data mode)
- Vite
- Tailwind CSS v4
- SVGL shadcn registry icons

## Brand Note

A tool from the [Logbook for Devs](https://logbookfordevs.com/).

Charting the technical seas, one commit at a time.

## Documentation content and Markdown exports

Author chapters in `src/docs/content/<id>.mdx` and register their title, summary,
and reading order in `src/docs/chapters.ts`. Existing reader URLs remain
`/docs?chapter=<id>`. Keep explicit heading IDs when editing a chapter so saved
section links continue to work.

Use ordinary Markdown for prose and tables. Retain semantic HTML for definition
lists and disclosure sections. A fenced code block's language is followed by its
visible label, for example `bash preview setup`; labeled blocks receive the
existing command-copy control. Escape pipes inside table cells, including pipes
inside inline code, as `\|`.

The Vite docs plugin compiles the same chapter sources into:

- `/docs/<id>.md`: one chapter, with an absolute source URL and portable links.
- `/llms.txt`: chapter descriptions and links to the Markdown files.
- `/llms-full.txt`: the complete manual, including disclosure content.

Exports are generated during `pnpm build` and served directly by `pnpm dev`.
Do not edit generated files in `dist`. The compiler and HTML-to-Markdown tools
are build dependencies; they are not shipped to the browser. The documentation
UI loads separately from the homepage.

The page menu copies the chapter export or opens its Markdown URL. On the public
origin configured in `src/docs/doc-links.ts`, ChatGPT and Claude links carry a
short prompt referencing the public export. Local and preview deployments use a
copy-and-paste handoff instead, since their content may not be publicly reachable.
These links do not call an AI API or guarantee that an assistant retrieves a page.
Publish the generated exports together with the site before testing public AI
handoffs. Vercel's configuration serves the Markdown as plain text.

Run the export and URL checks from the repository root:

```sh
pnpm site:test
pnpm site:typecheck
pnpm --dir apps/site lint
pnpm --dir apps/site build
```

Implementation references: [React Router data mode](https://reactrouter.com/start/data/installation), [lazy routes](https://reactrouter.com/start/data/route-object#lazy), [scroll restoration](https://reactrouter.com/api/components/ScrollRestoration), and [Vite TypeScript checking](https://vite.dev/guide/features.html#typescript).
