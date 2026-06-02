# Interactive Setup Default Source

Update AFK setup so interactive setup always asks which defaults source/origin to use before loading manifests, while keeping saved default changes explicit. A prompted source is one-run-only; `afk setup --default-source <source>` is the preferred command for changing the saved default.

Use `facts.md` as the accepted behavior contract and `plan.md` as the implementation plan.

Done when the accepted facts are implemented, covered by automated tests, and validated with `pnpm --dir packages/afk test` plus `npx tsc --noEmit` from `packages/afk`.
