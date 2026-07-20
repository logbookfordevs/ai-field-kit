# AFK owns Harness Adapters

Custom Agent sources will express behavior through AFK's Portable Agent Contract, while AFK will own the adapters that translate that contract into harness-native definitions. Source-owned adapter overrides are excluded initially so agent authors do not maintain drifting harness copies and AFK can provide predictable portability.

The contract separates required capabilities, optional capabilities, and access posture from the facilities a harness provides. AFK emits only declared settings; omission leaves the target harness or parent session in control. If a required capability is unavailable, AFK does not provision that Custom Agent to the target and reports why. If an optional capability is unavailable, AFK provisions the agent and reports the omission rather than silently claiming full fidelity.

Agent instructions may mention skills or other user-managed facilities. AFK does not model, install, or validate those references as Custom Agent dependencies; users remain responsible for making them available in their harness.
