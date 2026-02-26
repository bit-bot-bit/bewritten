# Mythos AI: Story Architect

Mythos AI is an intelligent, AI-powered creative writing suite designed to help authors craft complex narratives, maintain continuity, and visualize story structures. By integrating Google's Gemini models directly into the writing workflow, Mythos acts as a co-author, editor, and world-builder.

## 🌟 Key Features

### 1. **AI-Assisted Writing & Editing**
*   **Smart Editor**: A distraction-free writing environment that toggles between Edit Mode and a visualized Book View (A5, Standard, Pocket sizes).
*   **Continuity Check**: Analyze your written chapters against your defined characters and settings to find contradictions or plot holes using Gemini 3 Flash.
*   **Co-Author Chat**: A dedicated AI assistant context-aware of your specific story bible to answer questions or brainstorm ideas.

### 2. **Dynamic Story Bible**
*   **Character Manager**: Create characters manually or generate detailed profiles using AI. Scan your written chapters to automatically detect and update character traits and descriptions.
*   **World Building**: specific location tracking that records history and events per chapter. Scan text to auto-populate location data.

### 3. **Plot & Pacing Visualization**
*   **Timeline Manager**: Map out plot points and visualize the **Tension Arc** of your story using interactive charts.
*   **AI Suggestions**: Stuck on what happens next? Ask the AI to suggest the next logical plot beat based on your current trajectory.

### 4. **Multi-Story Management**
*   **Library**: Manage multiple distinct stories and universes.
*   **User Isolation**: Secure login system (simulated) that isolates data per user, allowing multiple writers to use the same device without data overlap.
*   **Account Backup**: Export/import a versioned `.bwrx` account backup file covering stories, chapters, characters, world, and plot data.

### 5. **Export & Publishing**
*   **Multi-Format Export**: Download your work as Markdown, Plain Text, or formatted HTML/PDF.
*   **AI Formatting**: Generate custom CSS for print-ready layouts based on natural language descriptions (e.g., "Fantasy novel with drop caps and wide margins").
*   **Blurb Generator**: Automatically generate back-cover synopsis based on your story content.

## 🛠️ Technical Stack

*   **Frontend**: React 19, TypeScript
*   **Styling**: Tailwind CSS
*   **AI Integration**: Google GenAI SDK (`@google/genai`), using models like `gemini-3-flash-preview` for low latency.
*   **Visualization**: Recharts for plot tension graphs.
*   **Icons**: Lucide React.
*   **State Management**: React State + LocalStorage persistence.

## 🚀 Getting Started

1.  **Authentication**:
    *   On launch, you will be greeted by the Authentication Screen.
    *   Enter an email and password (this is a local simulation, no real backend is required).
    *   Your stories are saved specifically to your email key in LocalStorage.

2.  **Creating a Story**:
    *   Click "Create New Story" or select the default template "Neon Echoes".
    *   Navigate to the **Write** tab to begin drafting.

3.  **Using AI Tools**:
    *   **Scan**: In Characters, World, or Plot tabs, use the "Scan" button to read your current chapter and extract data automatically.
    *   **Analyze**: In the Editor sidebar, click "Analyze" to run a continuity check.
    *   **Co-Author**: Click the floating chat button in the bottom right to talk to your story.

## 🎨 Themes

The application supports multiple visual themes to match your writing mood:
*   **Nexus**: A clean, modern slate/indigo theme (Default).
*   **Grimm**: A warm, earthy theme for fantasy writers.
*   **Nebula**: A high-contrast dark theme for sci-fi writers.

## ⚠️ Requirements

*   **API Key**: This application requires a valid Google Gemini API Key provided in the environment variables.
*   **Production Secrets**: Default admin/password and secret key values are for development only. In Kubernetes, use chart-backed Secret refs (or `secrets.existingSecret`) before production deployment.

## 📄 License

This project is licensed under the **bit-bot-bit Noncommercial Opensource License v1.0.0**.

*   **Free for Personal Use:** You are free to use, modify, and distribute this software for non-commercial purposes.
*   **Commercial Use:** Any use for commercial advantage, financial gain, or monetary compensation requires a separate commercial license from the original authors (**bit-bot-bit**).
*   **Ownership of Content:** You retain full ownership of any literary works, characters, and other content you create using this software.
*   **Derivative Works:** Derivatives of the software shall not be used to monetize or take ownership of user-generated content.
*   **Data Responsibility:** You are solely responsible for the maintenance and backup of your data. The licensor is not liable for any data loss.
*   **As-Is & No Liability:** The software is provided "as-is". The licensor is not liable for any misuse, behavior, or output of the tooling (including AI hallucinations).
*   **Contact for Commercial Licensing:** For commercial licensing inquiries, please contact: bit-bot-bit@terlek.com

See [LICENSE](LICENSE) for the full license text.

---

*Craft Worlds. Weave Myths.*
