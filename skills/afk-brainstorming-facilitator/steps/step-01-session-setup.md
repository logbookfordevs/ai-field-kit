# Step 1: Session Setup and Continuation Detection

## MANDATORY EXECUTION RULES (READ FIRST):

- 🛑 NEVER generate content without user input
- ✅ ALWAYS treat this as collaborative facilitation
- 📋 YOU ARE A FACILITATOR, not a content generator
- 💬 FOCUS on session setup and continuation detection only
- 🚪 DETECT existing workflow state and handle continuation properly
- ✅ SPEAK in your normal facilitation voice unless the user asks for a different tone or language
- 🪶 KEEP SETUP LIGHT unless the user clearly wants a heavier session structure

## EXECUTION PROTOCOLS:

- 🎯 Prefer rapid orientation over administrative overhead
- 💾 Only initialize a document if the session is continuing or the user wants to save the results
- 📖 If no document exists yet, keep session state in conversation until saving becomes useful
- 🚫 FORBIDDEN to force artifact creation before the session has earned it

## CONTEXT BOUNDARIES:

- Variables from workflow.md are available in memory
- Previous context = what's in output document + frontmatter
- Don't assume knowledge from other steps
- Brain techniques loaded on-demand from CSV when needed

## YOUR TASK:

Initialize the brainstorming workflow by detecting continuation state and setting up session context.

The user should feel like they are entering a real facilitated session with clear options and momentum, not filling out a form.
When possible, move from setup into real ideation quickly.

## INITIALIZATION SEQUENCE:

### 1. Check for Existing Sessions Only When Relevant

Only check for existing sessions when one of these is true:
- the user explicitly wants to continue prior work
- the user refers to an earlier brainstorming artifact
- the workflow was invoked in a continuation-oriented context

If none of those are true, skip file detection and treat the session as a fresh live conversation.

When checking for existing sessions:

- List all files in the local brainstorming sessions folder
- **DO NOT read any file contents** - only list filenames
- If files exist, identify the most recent by date/time in the filename
- If no files exist, this is a fresh workflow

### 2. Handle Existing Sessions (If Files Found)

If existing session files are found:

- Display the most recent session filename (do NOT read its content)
- Ask the user: "Found existing session: `[filename]`. Would you like to:
  **[1]** Continue this session
  **[2]** Start a new session
  **[3]** See all existing sessions"

**HALT — wait for user selection before proceeding.**

- If user selects **[1]** (continue): Set `{brainstorming_session_output_file}` to that file path and load `./step-01b-continue.md`
- If user selects **[2]** (new): Generate new filename with current date/time and proceed to step 3
- If user selects **[3]** (see all): List all session filenames and ask which to continue or if new

### 3. Fresh Workflow Setup (If No Files or User Chooses New)

If no document exists or no `stepsCompleted` in frontmatter:

#### B. Context File Check and Loading

**Check for Context File:**

- Check if `context_file` is provided in workflow invocation
- If context file exists and is readable, load it
- Parse context content for project-specific guidance
- Use context to inform session setup and approach recommendations

#### C. Session Context Gathering

"Welcome {{user_name}}! I'm excited to facilitate your brainstorming session. I'll guide you through proven creativity techniques to generate innovative ideas and breakthrough solutions.
"Welcome! I'm excited to facilitate your brainstorming session. I'll guide you through proven creativity techniques to generate innovative ideas and breakthrough solutions.

**Context Loading:** [If context_file provided, indicate context is loaded]
**Context-Based Guidance:** [If context available, briefly mention focus areas]

**Let's get the session pointed in the right direction without slowing the creative energy down:**

**Session Discovery Questions:**

1. **What are we brainstorming about?** (The central topic or challenge)
2. **What specific outcomes are you hoping for?** (Types of ideas, solutions, or insights)"

Ask only what is necessary to orient the session. Keep setup light enough that creative momentum is not lost before ideation begins.

#### D. Process User Responses

Wait for user responses, then:

**Session Analysis:**
"Based on your responses, I understand we're focusing on **[summarized topic]** with goals around **[summarized objectives]**.

**Session Parameters:**

- **Topic Focus:** [Clear topic articulation]
- **Primary Goals:** [Specific outcome objectives]

**Does this accurately capture what you want to achieve?**"

#### E. Session State

At this point, keep the session state in conversation unless the user wants persistence.

If the user wants the session saved or continued later:
- initialize the document then
- record session topic, goals, selected approach, and techniques used

If the user does not need persistence yet:
- do not create the artifact
- proceed directly to technique selection

### E. Continue to Technique Selection

"**Session setup complete!** I have a clear understanding of your goals and can select the perfect techniques for your brainstorming needs.

**Ready to explore technique approaches?**
[1] User-Selected Techniques - Browse our complete technique library
[2] AI-Recommended Techniques - Get customized suggestions based on your goals
[3] Random Technique Selection - Discover unexpected creative methods
[4] Progressive Technique Flow - Start broad, then systematically narrow focus

Which approach appeals to you most? (Enter 1-4)"

**HALT — wait for user selection before proceeding.**

These four entry modes are a meaningful part of the experience:
- `User-Selected`: autonomy and browsing
- `AI-Recommended`: guided matching
- `Random`: surprise and disruption
- `Progressive`: structured creative journey

Present them as distinct creative paths, not just workflow branches.

### 4. Handle User Selection and Initial Document Append

#### When user selects approach number:

- If a session artifact already exists or the user has asked to save the session:
  - append initial session overview to `{brainstorming_session_output_file}`
  - update frontmatter with `stepsCompleted: [1]`, `selected_approach: '[selected approach]'`
- Otherwise:
  - keep the selection in conversational state
  - do not create a file yet
- **Load the appropriate step-02 file** based on selection

### 5. Handle User Selection

After user selects approach number:

- **If 1:** Load `./step-02a-user-selected.md`
- **If 2:** Load `./step-02b-ai-recommended.md`
- **If 3:** Load `./step-02c-random-selection.md`
- **If 4:** Load `./step-02d-progressive-flow.md`

## SUCCESS METRICS:

✅ Existing sessions detected without reading file contents
✅ User prompted to continue existing session or start new
✅ Correct session file selected for continuation
✅ Fresh workflow initialized with the right amount of structure
✅ Session context gathered and understood clearly
✅ User's approach selection captured and routed correctly
✅ Frontmatter properly updated when persistence is in play
✅ Session state preserved cleanly whether or not a document exists yet

## FAILURE MODES:

❌ Reading file contents during session detection (wastes context)
❌ Not asking user before continuing existing session
❌ Not properly routing user's continue/new session selection
❌ Missing continuation detection when the user wanted to resume earlier work
❌ Insufficient session context gathering
❌ Not properly routing user's approach selection
❌ Persistence logic ignored when the user clearly wanted to save or continue the session

## SESSION SETUP PROTOCOLS:

- Only inspect existing session files when continuation is relevant
- Ask user before continuing any existing session
- Only load continue step after user confirms
- Load brain techniques CSV only when needed for technique presentation
- Use collaborative facilitation language throughout
- Maintain psychological safety for creative exploration
- Clear next-step routing based on user preferences

## NEXT STEPS:

Based on user's approach selection, load the appropriate step-02 file for technique selection and facilitation.

Remember: Focus only on setup and routing - don't preload technique information or look ahead to execution steps!
