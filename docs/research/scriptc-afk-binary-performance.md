# ScriptC for AFK released-binary performance

Checked 2026-08-10 against ScriptC 0.0.23 and the current AFK 1.2.2 source. This is an evaluation only.

## Decision

**Do not replace AFK's npm/Node release with ScriptC yet.** ScriptC is promising for cold-start time, memory, and a self-contained executable, but AFK's current dependency and platform shape pushes it toward ScriptC's dynamic tier. That tier is host-native only, cannot be cross-compiled, and Windows still lacks `child_process`, which AFK uses for its core delegation and update paths. ScriptC also labels its CLI experimental and remains on a `0.0.x` release line. [ScriptC platform support](https://scriptc.dev/platforms), [ScriptC CLI reference](https://scriptc.dev/cli), [ScriptC v0.0.23 release](https://github.com/vercel-labs/scriptc/releases/tag/v0.0.23), [AFK CLI imports](../../packages/afk/src/cli.ts), [AFK manifest execution](../../packages/afk/src/manifest.ts)

The useful next step is a **macOS-arm64 experimental artifact**, gated by compatibility and AFK-specific measurements, while retaining the npm/Node build as the supported release. It should not be called a performance improvement until an AFK workload benchmark confirms it.

## What ScriptC produces

ScriptC type-checks TypeScript with the TypeScript compiler, lowers it to a typed IR, emits LLVM IR by default (falling back to its reference C backend), and invokes clang to create a native executable. Static builds carry no Node, V8, or JavaScript engine; runtime feature units are link-gated. [How ScriptC works](https://scriptc.dev/how-it-works), [CLI reference](https://scriptc.dev/cli)

There are three explicit outcomes: supported application code compiles statically; npm dependency code and `any`-typed operations can run in an opt-in quickjs-ng “dynamic island”; unsupported constructs fail with coded diagnostics. `scriptc coverage` reports the split per application statement and the Node builtins reached by embedded dependencies. [Coverage reports](https://scriptc.dev/coverage), [npm dependencies](https://scriptc.dev/dependencies)

This is not Node executable packaging. ScriptC reimplements a supported Node/API surface and documents semantic differences, including dense arrays that trap on out-of-bounds access, copied rather than aliased structural values, QuickJS rather than V8 for dependency code, shimmed Node builtins, and different static/dynamic microtask interleaving. [Limitations](https://scriptc.dev/limitations)

## Performance evidence

ScriptC reports, on Apple M-series hardware, approximately 2.4 ms startup versus 47 ms for Node, 170–200 KB static binaries or about 3 MB with `--dynamic` and embedded dependencies, and 1–4 MB typical RSS versus 67–116 MB for Node. It explicitly says QuickJS dependency code is slower than Node for CPU-bound work, and that integer inference and ownership analysis are roadmap items. [ScriptC README performance table](https://github.com/vercel-labs/scriptc/blob/b94c88e31cf80e42407b1c4cf1c6c7f6198adda5/README.md#performance), [dynamic-tier limits](https://scriptc.dev/limitations)

Evidence quality is **directional, not release-decision grade**. The published performance table gives broad hardware and comparison descriptions, but no benchmark commands, fixtures, sample counts, variance, cold/warm-cache policy, power state, exact Node/system versions, or downloadable result data. Its quickstart separately says about 4 ms versus 35 ms for hello-world, so even first-party headline figures vary by page and test context. These numbers demonstrate potential, not AFK's expected gain. [README performance table](https://github.com/vercel-labs/scriptc/blob/b94c88e31cf80e42407b1c4cf1c6c7f6198adda5/README.md#performance), [quickstart](https://scriptc.dev/quickstart)

ScriptC's correctness evidence is stronger than its performance evidence: it reports 800+ differential tests comparing stdout, stderr, and exit codes with Node, plus an AddressSanitizer/reference-count lane. Current CI runs macOS differential and sanitizer shards, a Linux host-clang static build, and a Windows CLI smoke build; the Windows job is not a full AFK-like dynamic/delegating CLI proof. [correctness design](https://scriptc.dev/how-it-works), [CI workflow](https://github.com/vercel-labs/scriptc/blob/b94c88e31cf80e42407b1c4cf1c6c7f6198adda5/.github/workflows/ci.yml)

## Fit with AFK

AFK is a strict ESM TypeScript CLI targeting ES2022/NodeNext with Node `>=20`, so its entry language and compiler-version floor are conceptually compatible with ScriptC's Node `>=20` CLI. ScriptC itself is installed and run under Node and needs clang; only its produced executable removes the Node requirement. [AFK package](../../packages/afk/package.json), [AFK tsconfig](../../packages/afk/tsconfig.json), [ScriptC quickstart](https://scriptc.dev/quickstart), [ScriptC package](https://github.com/vercel-labs/scriptc/blob/b94c88e31cf80e42407b1c4cf1c6c7f6198adda5/packages/cli/package.json)

AFK is unlikely to be fully static unchanged:

- Its command graph eagerly imports `@inquirer/prompts` through lobby/menu/configuration modules and imports `yaml`; ScriptC's default treatment for npm packages is the dynamic island. [AFK CLI](../../packages/afk/src/cli.ts), [AFK package dependencies](../../packages/afk/package.json), [ScriptC npm dependencies](https://scriptc.dev/dependencies)
- AFK uses `node:child_process` for delegated installers, catalog refresh, update, and platform operations. ScriptC implements a static `child_process` surface on its primary platform, but Windows support explicitly omits it. [AFK CLI](../../packages/afk/src/cli.ts), [AFK manifest](../../packages/afk/src/manifest.ts), [ScriptC platforms](https://scriptc.dev/platforms)
- AFK expects Node-compatible filesystem, process, fetch, signals, interactive terminal behavior, package-relative files, and subprocess behavior. ScriptC supports meaningful subsets of those APIs, but its own docs say the real compatibility answer is the program-specific coverage/build report, not the general support list. [AFK source](../../packages/afk/src), [ScriptC limitations](https://scriptc.dev/limitations), [coverage reports](https://scriptc.dev/coverage)
- Native Node addons are not part of ScriptC's documented npm-island contract: package JavaScript is embedded and Node builtins are shims, while native interoperability is a separate manifest-declared C FFI with documented limits. AFK's current direct dependencies are JavaScript packages, but future transitive native addons would need an explicit compatibility review. [npm dependencies](https://scriptc.dev/dependencies), [native FFI](https://scriptc.dev/ffi), [AFK dependencies](../../packages/afk/package.json)

`--npm-static` could eventually reduce the dynamic remainder, but ScriptC marks it experimental; deferred unsupported sites can fail only when reached at runtime. It is unsuitable as the basis of AFK's supported release today. [npm dependencies](https://scriptc.dev/dependencies)

## Distribution, updates, signing, and platforms

ScriptC's primary/full platform is macOS arm64. Static programs can cross-compile from macOS through Zig to Linux arm64/x86_64 and Windows x86_64. Dynamic binaries are host-native only; Windows lacks servers and `child_process`. Linux examples target a declared glibc version and are dynamically linked, so target-libc selection becomes part of AFK's compatibility contract. [Platform support](https://scriptc.dev/platforms)

AFK currently releases one npm package and its installer requires Node `>=20`, writes a launcher that executes `node .../dist/index.js`, and updates through the hosted installer/npm release path. Shipping native executables would require a new artifact matrix, asset selection/download logic, checksum policy, rollback behavior, and a migration path that preserves the current updater. [AFK installer](../../scripts/install.sh), [AFK update implementation](../../packages/afk/src/update-check.ts), [AFK package](../../packages/afk/package.json)

ScriptC publishes compiler packages, not prebuilt application binaries; its release process explicitly has no platform binary assets because compilation occurs on the user's machine. Its CLI does not document code-signing, macOS notarization, Windows Authenticode signing, or universal macOS binaries. Therefore AFK would own those release-security steps after compilation; this is an inference from ScriptC's documented build and release surfaces, not a claim that externally signing the output is impossible. [ScriptC releasing](https://github.com/vercel-labs/scriptc/blob/b94c88e31cf80e42407b1c4cf1c6c7f6198adda5/RELEASING.md), [CLI reference](https://scriptc.dev/cli)

## Maturity, licensing, and security posture

ScriptC 0.0.23 is Apache-2.0 and its CLI calls itself experimental. Releases are automated from `main` through npm trusted publishing with OIDC and attach a machine-readable surface manifest; the official repository's release commits are GitHub-verified. These are useful supply-chain controls, but the early version line, fast-moving compatibility surface, and documented experimental features make a pinned compiler plus repeatable AFK compatibility suite necessary. [license](https://github.com/vercel-labs/scriptc/blob/b94c88e31cf80e42407b1c4cf1c6c7f6198adda5/LICENSE), [CLI reference](https://scriptc.dev/cli), [release process](https://github.com/vercel-labs/scriptc/blob/b94c88e31cf80e42407b1c4cf1c6c7f6198adda5/RELEASING.md), [v0.0.23 release](https://github.com/vercel-labs/scriptc/releases/tag/v0.0.23)

The compiler/runtime become part of AFK's native trusted computing base. ScriptC's ASan and differential lanes reduce semantic and memory-safety risk, but they do not replace AFK-specific adversarial tests for filesystem writes, process spawning, installer execution, terminal cancellation, update checks, and catalog parsing. [ScriptC correctness](https://scriptc.dev/how-it-works), [AFK tests and scripts](../../packages/afk/src)

## Required pilot and benchmark gate

Run this only as a disposable macOS-arm64 experiment, pinned to one ScriptC version:

1. Run `scriptc coverage packages/afk/src/index.ts` and again with `--dynamic`; archive the complete reports and treat every blocker/unshimmed builtin as a failure.
2. Build with `--dynamic`, then exercise `--version`, `--help`, dry-run setup/refresh, interactive cancel, catalog reads, YAML parsing, update dry-run, delegated subprocesses, malformed input, signals, and package-relative asset lookup against the same AFK version under Node. Compare stdout, stderr, exit code, and filesystem effects.
3. Benchmark both artifacts with the same release content on a quiet machine: at least 100 fresh-process samples per command, randomized A/B order, separate cold and warm filesystem-cache runs, and report median, p95, bootstrap confidence intervals, peak RSS, executable plus required-resource size, and build time. Include quick commands (`--version`, `--help`) and representative I/O/subprocess commands; do not use hello-world as the acceptance workload.
4. Accept only if compatibility is exact for the supported pilot surface and the user-visible gain is material after including dynamic-island startup and embedded dependency size. A reasonable initial gate is at least 20 ms median or 30% cold-start improvement on quick commands, with no command regression over 5%, no new platform caveat, and no loss of update/recovery behavior.

Until that pilot passes, ScriptC's value to AFK is **an experimental performance track, not a release migration**.
