# Limit Custom Agents to provisioning

AFK will make portable Custom Agents available through harness-specific adapters, but it will not launch, coordinate, or supervise their runtime instances. Agent orchestration remains the responsibility of harnesses and dedicated orchestration tooling, avoiding a duplicate runtime product inside AFK.

The initial Harness Adapters target Codex, Claude Code, and Pi through the `pi-subagents` extension. If Pi is installed without that extension, setup suggests `pi install npm:pi-subagents`, skips Pi provisioning, and tells the user to rerun setup after installing it; AFK does not install the extension. Provisioning supports Personal Scope by default and explicit Project Scope. As with AFK's other setup areas, running setup writes the selected source state over the harness-native target files; AFK does not merge or preserve manual edits to those generated targets.
