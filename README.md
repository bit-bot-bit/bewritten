# Book Writing Assistant

A local-first desktop app for writing fiction with tracking for characters, continuity, and relationships.

## Features

-   **Local-First Storage**: All data stored in a human-readable project folder (YAML, Markdown, SQLite).
-   **Entity Tracking**: Characters, Locations, Scenes.
-   **Graph Visualization**: Interactive force-directed graph of relationships.
-   **Continuity Engine**: Checks for dead characters, location mismatches, etc.
-   **Provenance Tracking**: Logs every edit with author/AI attribution.
-   **AI Assistance**: Optional pluggable AI for review.

## Tech Stack

-   **Frontend**: React, TypeScript, Tailwind CSS, CodeMirror, React Force Graph.
-   **Backend**: Rust (Tauri), SQLite (Rusqlite).

## Getting Started

### Prerequisites

-   Node.js & npm
-   Rust & Cargo
-   System dependencies for Tauri (Linux: libwebkit2gtk-4.0-dev, build-essential, curl, wget, file, libssl-dev, libgtk-3-dev, libayatana-appindicator3-dev, librsvg2-dev)

### Installation

1.  Clone the repo.
2.  Install frontend dependencies:
    ```bash
    npm install
    ```
3.  Run in development mode:
    ```bash
    npm run tauri dev
    ```

## Usage

1.  **Create/Load Project**: Enter a path to a folder. If it doesn't exist, click "Create New".
2.  **Write**: Use the editor. Mentions (`@Character`, `#Location`) are auto-extracted.
3.  **Save**: Click "Save" to write to Markdown and update the database.
4.  **Graph**: Click "Graph" to see relationships.
5.  **Check**: Click "Check" to run continuity analysis.
6.  **History**: Click "History" to see the audit log.

## Project Structure

-   `src/`: React frontend.
-   `src-tauri/`: Rust backend.
-   `examples/`: Demo project.
