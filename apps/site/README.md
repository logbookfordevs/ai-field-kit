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

When hosting the production build, configure an SPA fallback to `index.html`
for `/docs` and `/docs/`. Vite provides this during local development.

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
