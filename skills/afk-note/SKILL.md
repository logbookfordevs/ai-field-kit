---
name: afk-note
description: Save durable notes to a local notepad file so important context survives long sessions, context loss, or workflow handoffs.
---

# Note Skill

Use this skill to keep important context in a simple local notepad so it can be recovered later.

The core job is lightweight memory preservation, not knowledge management.

## Usage

| Command | Action |
|---------|--------|
| `/note <content>` | Add to Working Memory with timestamp |
| `/note --priority <content>` | Add to Priority Context (always loaded) |
| `/note --manual <content>` | Add to MANUAL section (never pruned) |
| `/note --show` | Display current notepad contents |
| `/note --prune` | Remove entries older than 7 days |
| `/note --clear` | Clear Working Memory (keep Priority + MANUAL) |

If slash-command syntax is not available, use the same behaviors through normal tool or workflow actions.

## Storage

Use a local notepad file such as:
- `notepad.md`
- `.notes/notepad.md`
- another repository-appropriate path chosen by the workflow

Do not depend on a framework-specific storage path.

## Sections

### Priority Context (500 char limit)
- Intended to be loaded or checked first when possible
- Use for critical facts: "Project uses pnpm", "API in src/api/client.ts"
- Keep it short because this is the highest-value memory

### Working Memory
- Timestamped session notes
- Auto-pruned after 7 days
- Good for: debugging breadcrumbs, temporary findings

### MANUAL
- Never auto-pruned
- User-controlled permanent notes
- Good for: team contacts, deployment info

## Examples

```
/note Found auth bug in UserContext - missing useEffect dependency
/note --priority Project uses TypeScript strict mode, all files in src/
/note --manual Contact: api-team@company.com for backend questions
/note --show
/note --prune
```

## Behavior

1. Creates the notepad file if it doesn't exist
2. Parses the argument to determine section
3. Appends content with timestamp (for Working Memory)
4. Warns if Priority Context exceeds 500 chars
5. Confirms what was saved

## Integration

When used alongside other workflows:
- check Priority Context first
- use recent Working Memory entries as short-term recall
- preserve MANUAL entries unless the user explicitly changes them

This skill should help important context survive long sessions, compaction, handoffs, or interruptions without requiring a larger framework.

## Suggested Next Use

This is a support skill rather than a stage in the main flow.

Use it whenever:
- a previous skill produced important decisions worth preserving
- a chat reset or handoff is likely
- a longer planning/discussion process needs durable memory
