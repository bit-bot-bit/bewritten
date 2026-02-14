# Book Writing Assistant

A local-first desktop app for writing fiction with tracking for characters, continuity, and relationships.

## Features

-   **Local-First Storage**: All data stored in a human-readable project folder (YAML, Markdown, SQLite).
-   **Entity Tracking**: Characters, Locations, Scenes.
-   **Graph Visualization**: Interactive force-directed graph of relationships with **Smart Connections** (auto-updates based on scene co-occurrences).
-   **Continuity Engine**: Checks for dead characters, location mismatches, etc.
-   **Provenance Tracking**: Logs every edit with author/AI attribution.
-   **AI Assistance**: Optional pluggable AI (OpenAI, Ollama, etc.) for review. Configurable in Settings.

## Tech Stack

-   **Frontend**: React, TypeScript, Tailwind CSS, CodeMirror, React Force Graph.
-   **Backend**: Rust (Tauri), SQLite (Rusqlite).

## Getting Started

### Prerequisites

-   Node.js & npm
-   Rust & Cargo
-   **Linux System Dependencies** (required if building on Linux):
    ```bash
    sudo apt-get update
    sudo apt-get install -y libwebkit2gtk-4.0-dev \
        build-essential \
        curl \
        wget \
        file \
        libssl-dev \
        libgtk-3-dev \
        libayatana-appindicator3-dev \
        librsvg2-dev
    ```

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

### Automated Builds (GitHub Actions)

This repository includes a GitHub Actions workflow that automatically builds the application for:
-   **Linux** (`.deb`, `.AppImage`)
-   **Windows** (`.exe`, `.msi`)
-   **macOS** (`.app`, `.dmg`)

To get the latest build without setting up a dev environment, check the **Releases** or **Actions** tab in GitHub.

## Usage

1.  **Create/Load Project**: Enter a path to a folder. If it doesn't exist, click "Create New".
2.  **Write**: Use the editor. Mentions (`@Character`, `#Location`) are auto-extracted.
3.  **Save**: Click "Save" to write to Markdown and update the database.
4.  **Graph**: Click "Graph" to see relationships. Click "Update Connections" to infer relationships from text.
5.  **Check**: Click "Check" to run continuity analysis.
6.  **History**: Click "History" to see the audit log.
7.  **Settings**: Click the gear icon to configure AI provider (OpenAI, Ollama, etc.).

## Project Structure

-   `src/`: React frontend.
-   `src-tauri/`: Rust backend.
-   `examples/`: Demo project.
