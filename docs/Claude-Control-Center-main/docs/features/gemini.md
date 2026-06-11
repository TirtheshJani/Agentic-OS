# Gemini Integration

Claude Control Center includes a first-class integration for **Gemini**, allowing you to manage Gemini CLI sessions and data alongside your Claude Code activity.

## Sessions (`/gemini/sessions`)

The Gemini Sessions page provides a powerful browser for your Gemini CLI history.

### Filtering and Search
- **Search**: Full-text search across task text, project names, session IDs, and custom notes.
- **Model Filter**: Filter by specific Gemini models (e.g., `gemini-2.0-flash`, `gemini-1.5-pro`).
- **Project Filter**: Scope sessions to a specific codebase.
- **Starred**: View only your bookmarked sessions.
- **Min Tools**: Filter for sessions that involved heavy tool usage.

### Sorting
- **Newest/Oldest**: Chronological sorting.
- **Duration**: Find the longest-running sessions.
- **Tools**: Sort by the total number of tool calls.
- **Turns**: Sort by the number of message exchanges.

### Session Detail
Clicking a session opens a detailed view of the event stream, showing:
- **User Turns**: Your prompts and instructions.
- **Agent Turns**: Gemini's responses and reasoning.
- **Tool Invocations**: Detailed logs of every tool Gemini called (Bash, File I/O, etc.).
- **Metadata**: Timestamps, durations, and model parameters.

## Analytics (`/gemini/stats`)
Gemini-specific usage statistics:
- **Token Usage**: Input and output tokens per model.
- **Activity Heatmap**: Daily activity patterns for Gemini sessions.
- **Model Distribution**: Which Gemini models you use most.

## Settings & Skills
- **Gemini Settings**: GUI editor for your Gemini CLI configuration.
- **Gemini Skills**: List and manage skills specifically installed for Gemini.
- **Gemini Memory**: View and edit the persistent memory entries used by Gemini CLI.

## Technical Details
- **Scanner**: The backend uses a dedicated `gemini_session_scanner` to parse Gemini CLI log files.
- **Caching**: Statistics and session lists are cached to ensure a responsive UI.
- **Manual Scan**: You can trigger a manual rescan from the Sessions page to pick up the latest Gemini activity.
