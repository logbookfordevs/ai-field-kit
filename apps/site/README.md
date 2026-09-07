# AI Field Kit Page

[Website](https://ai-field-kit.logbookfordevs.com/) · [Documentation](https://ai-field-kit.logbookfordevs.com/docs)

A React + Vite homepage and documentation site for [AI Field Kit](https://github.com/logbookfordevs/ai-field-kit), the portable rules, skills, workflows, and MCP setup for multi-agent developers.

## Quick Start

```bash
pnpm --dir apps/site install
pnpm site:dev
```

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
`src/docs/GuideContent.jsx`, with layout and reading styles beside it.

For Vercel, set the project's Root Directory to `apps/site`. The included
`vercel.json` rewrites `/docs` and `/docs/` to `index.html`, preserving chapter
query parameters. Redeploy after changing this configuration. Other hosts need
the same SPA fallback; Vite provides it during local development.

Check command examples against `packages/afk/src/cli.ts` and setup behavior
before updating the guide. Website validation does not require running setup
against a real agent configuration.

## Stack

- React
- Vite
- Tailwind CSS v4
- SVGL shadcn registry icons

## Brand Note

A tool from the [Logbook for Devs](https://logbookfordevs.com/).

Charting the technical seas, one commit at a time.
