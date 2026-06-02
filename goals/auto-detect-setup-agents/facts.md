# Facts

- AFK setup commands automatically detect compatible installed agent targets by default instead of repeatedly asking the user to choose agent targets.
- Rules, MCPs, hooks, and additional skill-provider installs use detected compatible targets when no explicit agent target is provided.
- Utilities are not tied to detected agent targets; utilities remain scoped by global or project setup behavior.
- Universal skills continue to install to the shared .agents/skills location regardless of detected agent-specific skill providers.
- If a selected target-dependent setup area has no detected compatible targets, AFK asks for manual agent targets once instead of silently skipping or using broad defaults.
- Agent detection uses centralized conservative evidence rules, such as known config files or known agent directories, rather than broad unstructured home-directory guesses.
- Explicit CLI target flags such as --agent continue to narrow or override detected targets.
- Detected targets are visible in dry-run or setup summary output so users can understand what AFK plans to touch.
- Custom agent target paths are configured through a separate local AFK config surface, not through presets.json.
- presets.json remains focused on defaults sources and named setup presets, not local machine detection state.
