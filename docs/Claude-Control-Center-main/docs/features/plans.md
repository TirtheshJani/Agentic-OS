# Plans & Tasks

Claude Control Center provides a dedicated interface for managing Claude Code plans and monitoring active tasks.

## Plans (`/plans`)

Plans are markdown files stored in `~/.claude/plans/`. They are used by Claude Code to track multi-step goals and progress.

### Plan List
The main Plans page lists all available plan files, sorted by the most recently modified. Each entry shows:
- **Title**: Extracted from the first `#` heading in the file.
- **Preview**: A short snippet of the "Context" section.
- **Modified Date**: When the plan was last updated.

### Plan Editor
Clicking on a plan opens the editor. It uses **CodeMirror** with markdown syntax highlighting.
- **Save**: Writes the updated markdown back to `~/.claude/plans/`.
- **Archive**: Moves the plan to `~/.claude/plans/archived/`. Archived plans are accessible via the **Archived** tab.

### Progress Tracking
The dashboard automatically parses your plan's markdown for checklist items (e.g., `- [ ]` or `- [x]`).
- **Steps**: Displays all steps with their current status.
- **Toggle**: You can check/uncheck steps directly from the UI.
- **Evidence**: Some steps may have associated "evidence" (notes or tool output) captured during execution.
- **Progress Bar**: A visual indicator of how many steps are completed.

### Pinning Sessions
You can "pin" a specific Claude Code session to a plan. This helps you track which session was responsible for which part of the plan.

---

## Tasks (`/tasks`)

Tasks are short-lived operations managed by Claude Code. The Tasks page reads active task state from `~/.claude/tasks/`.

### Task Monitor
- **Active Tasks**: Lists directories in `~/.claude/tasks/` that have an active `.lock` file.
- **Status**: Indicates if a task is currently running or locked.
- **Highwatermark**: Displays the "highwatermark" value if available, which represents the progress or latest event ID processed by the task.

The Task monitor is useful for identifying "hung" tasks that may need manual cleanup (deleting the `.lock` file) if a session crashed.
