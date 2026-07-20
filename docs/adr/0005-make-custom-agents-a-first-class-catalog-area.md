# Make Custom Agents a first-class catalog area

Custom Agents will use the same public AFK catalog model as other setup areas rather than a standalone entry point. The area includes `agents.json`, `afk refresh`, `afk setup agents`, `afk show agents`, and `afk catalog agents`, with contextual help, summaries, and interactive menu routes so both people and agents can discover and operate it consistently. Catalog maintenance supports `add`, `edit`, and `remove`; Custom Agent entries have no `default` field or default-toggle command.

Refresh merges by Agent Name: incoming entries replace matches, new entries are appended, and existing entries absent upstream remain until explicitly removed. Refresh remains catalog-only and does not provision agents.

Interactive agent setup presents every cataloged Custom Agent through checkbox selection with every item initially unchecked. Non-interactive setup accepts repeatable `--custom-agent <id>` selections or `--all`; `--agent` continues to select target harnesses, and `--yes` only suppresses confirmation rather than selecting items. A non-interactive run without explicit Custom Agent selections or `--all` fails with actionable help.
