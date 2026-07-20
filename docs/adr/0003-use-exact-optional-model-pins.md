# Use exact optional Model Pins

The Portable Agent Contract may declare an exact model identifier or native alias separately for each harness. AFK will pass declared values through, inherit the harness model when a target has no pin, allow local overrides, and report unavailable pins without silently substituting another model; semantic tiers such as `balanced` or `strongest` are excluded because their meaning would drift as models change.

The same inheritance rule applies to optional per-harness effort pins. AFK translates declared values to each harness's native effort or thinking field and leaves the setting inherited when omitted.
