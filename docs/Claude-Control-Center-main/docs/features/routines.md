# Routines

Routines are scheduled or automated skill executions managed by Claude Code. The Routines page (`/routines`) provides visibility into their execution history and performance.

## Usage History
The Routines page tracks every time a routine or scheduled skill is invoked.

- **Invocation Log**: A searchable and filterable list of all routine runs.
- **Metadata**: Each record includes:
    - **Timestamp**: When the routine ran.
    - **Skill**: Which skill was executed.
    - **Project**: The project context for the run.
    - **Session ID**: The underlying Claude session that handled the execution.
    - **Status**: Whether the routine completed successfully.

## Statistics
Aggregated statistics help you understand your automation usage:
- **Total Invocations**: Overall count of routine runs.
- **Skill Breakdown**: See which skills are running most frequently.
- **Project Distribution**: Identify which projects are most active with automation.

## Scanning
The dashboard periodically scans for new routine activity. You can also trigger a manual **Scan** from the Routines page to ensure you are seeing the most recent data.

Data is cached in `backend/data/routines_usages.json` to ensure fast page loads.
