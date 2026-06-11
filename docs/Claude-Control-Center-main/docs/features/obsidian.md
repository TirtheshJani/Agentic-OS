# Obsidian Integration

Claude Control Center features deep integration with **Obsidian**, allowing you to use your vaults as both a source of knowledge for Claude and a destination for your research.

## Vault Management (`/obsidian/vaults`)
You can add multiple Obsidian vaults to the dashboard by specifying their local filesystem paths.

- **Enable/Disable**: Toggle vaults on or off to control which ones are used for sync.
- **Metadata**: The dashboard tracks the last sync time and the total number of notes in each vault.

## Note Browser
Browse and read your Obsidian notes directly in the dashboard.
- **Folder Navigation**: Navigate your vault's directory structure.
- **Search**: Perform full-text search across all notes in a vault.
- **Editor**: A built-in markdown editor allows you to make quick changes to your notes.

## Memory Sync (RAG)
This is the most powerful part of the integration. You can "ingest" your Obsidian notes into the **Memory RAG** (powered by LightRAG).

- **How it works**: The backend scans your vault, extracts text from markdown files, and inserts it into the local RAG index.
- **Claude Knowledge**: Once ingested, Claude can use the knowledge from your Obsidian notes during sessions (if the Memory RAG feature is enabled with an `ANTHROPIC_API_KEY`).
- **Source Tracking**: Every piece of knowledge in the RAG index is tagged with its Obsidian source path.

## Pushing to Obsidian
From the **Research** and **Conversations** pages, you can "Push to Obsidian":
- Select a target vault and folder.
- The content is formatted as a clean markdown note.
- Tags and metadata from the dashboard are included in the Obsidian frontmatter.

## Configuration
Vault paths are stored in `backend/data/obsidian_vaults.json`. No changes are made to your `.obsidian` configuration folder.
