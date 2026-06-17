
```json
{
  "id": "afk-code-grill",
  "label": "AFK / Code Grill",
  "role": "wrapper",
  "autoInvocation": false,
  "composes": ["grilling", "truss-evaluation", "codebase-design"],
  "profiles": ["engineering"]
}
```

And:

```json
{
  "id": "codebase-design",
  "label": "External / Codebase Design",
  "role": "primitive",
  "autoInvocation": true,
  "profiles": ["engineering", "default"]
}
```

So:
- `autoInvocation: true` = model can discover it automatically, and user can still invoke it.
- `autoInvocation: false` = user must explicitly invoke it.
- `role` = why this skill exists architecturally.
- `composes` = what primitives/wrappers it depends on conceptually.
- `profiles` = where it should be active once profile support exists.

**2. Better `afk show`**
Show the skill architecture:

```text
AFK / Code Grill
role: wrapper
auto invocation: off
composes: grilling, truss-evaluation, codebase-design
profiles: engineering
```

This makes the manifest readable as a system map.

**3. Better `afk configure`**
The manifest editor can group skills by role:

```text
Primitive skills
  [on] grilling
  [on] truss-evaluation
  [on] codebase-design

Wrappers
  [on] afk-code-grill
  [on] afk-to-prd-spec

Flows
  [on] afk-sprint
  [on] afk-turbo
```

And warn/help, not block:

```text
afk-code-grill composes codebase-design, but codebase-design is disabled.
Enable composed primitive too?
```

**4. Profiles**
Profiles become curated activation sets:

```json
{
  "id": "engineering",
  "skills": [
    "afk-compass",
    "grilling",
    "truss-evaluation",
    "codebase-design",
    "domain-modeling",
    "diagnosing-bugs"
  ]
}
```

Then:

```bash
afk profile use engineering
```

would enable model-invoked skills for that profile and maybe disable unrelated ones.