import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import { Editor } from "./components/editor/Editor";
import { ContextSidebar } from "./components/sidebar/ContextSidebar";
import { ProvenanceView } from "./components/provenance/ProvenanceView";
import { GraphView } from "./components/graph/GraphView";
import { SuggestionPanel } from "./components/suggestions/SuggestionPanel";
import { SettingsModal } from "./components/settings/SettingsModal";

function App() {
  const [projectPath, setProjectPath] = useState("");
  const [isProjectLoaded, setIsProjectLoaded] = useState(false);
  const [content, setContent] = useState("# Chapter 1\n\nIt was a dark and stormy night. @Alice was waiting for @Bob at #TheOldMill.");
  const [isProvenanceOpen, setIsProvenanceOpen] = useState(false);
  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [issues, setIssues] = useState<any[]>([]);
  const [aiIssues, setAiIssues] = useState<string[]>([]);

  async function handleLoadProject() {
    try {
      await invoke("load_project", { path: projectPath });
      setIsProjectLoaded(true);
    } catch (error) {
      console.error(error);
      alert("Failed to load project: " + error);
    }
  }

  async function handleCreateProject() {
    try {
      await invoke("create_project", { path: projectPath });
      await invoke("load_project", { path: projectPath });
      setIsProjectLoaded(true);
    } catch (error) {
      console.error(error);
      alert("Failed to create project: " + error);
    }
  }

  async function handleSave(newContent: string) {
    try {
        await invoke("save_scene", {
            scene: {
                id: "scene-001",
                title: "Chapter 1",
                order: 1,
                summary: "",
                pov: "",
                time_marker: "",
                location_ids: [],
                participants: [],
                extracted_facts: []
            },
            content: newContent
        });
        console.log("Saved!");
    } catch (e) {
        console.error(e);
        alert("Save failed: " + e);
    }
  }

  async function handleCheckContinuity() {
    try {
        // First save to ensure extraction is up to date (or rely on backend re-extraction)
        // Currently `check_continuity` takes a Scene object.
        // But `save_scene` logic extracts entities. `check_continuity` logic relies on `scene.participants`.
        // If I pass empty participants here, local check will find nothing unless I replicate extraction.
        // Wait, `check_continuity` in rust uses `scene.participants` directly.
        // I should probably extract entities in `handleCheckContinuity` before sending, or move extraction to shared logic.
        // Or, simpler: call `save_scene` first, then fetch the updated scene?
        // But `save_scene` is fire-and-forget for extraction.

        // For MVP, I will rely on `save_scene` populating the DB, but `check_continuity` receives `scene` as argument.
        // Let's manually invoke extraction (or `analyze_text`) here to get participants.

        const analysis: any = await invoke("analyze_text", { text: content });

        const result: any = await invoke("check_continuity", {
            scene: {
                id: "scene-001",
                title: "Chapter 1",
                order: 1,
                summary: content,
                pov: "",
                time_marker: "",
                location_ids: Array.from(analysis.locations),
                participants: Array.from(analysis.characters),
                extracted_facts: []
            }
        });

        setIssues(result.local_issues);
        setAiIssues(result.ai_issues);
        setIsSuggestionOpen(true);
    } catch (e) {
        console.error(e);
        alert("Check failed: " + e);
    }
  }

  if (!isProjectLoaded) {
    return (
      <div className="container mx-auto p-4 max-w-md mt-20 text-center">
        <h1 className="text-2xl font-bold mb-4">Book Writer</h1>
        <div className="flex flex-col gap-4 text-left">
            <input
              className="border p-2 rounded"
              placeholder="/path/to/project"
              value={projectPath}
              onChange={(e) => setProjectPath(e.currentTarget.value)}
            />
            <div className="flex gap-2 justify-center">
                <button className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600" onClick={handleLoadProject}>Load Project</button>
                <button className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600" onClick={handleCreateProject}>Create New</button>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-left relative">
      <div className="flex-1 flex flex-col h-full">
        <header className="h-12 border-b flex items-center px-4 justify-between bg-gray-50 shrink-0">
            <span className="font-semibold text-gray-700">Chapter 1</span>
            <div>
                <button className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200 mr-2" onClick={() => setIsSettingsOpen(true)}>⚙️</button>
                <button className="text-sm bg-yellow-100 text-yellow-700 px-3 py-1 rounded hover:bg-yellow-200 mr-2" onClick={handleCheckContinuity}>Check</button>
                <button className="text-sm bg-orange-100 text-orange-700 px-3 py-1 rounded hover:bg-orange-200 mr-2" onClick={() => setIsGraphOpen(true)}>Graph</button>
                <button className="text-sm bg-purple-100 text-purple-700 px-3 py-1 rounded hover:bg-purple-200 mr-2" onClick={() => setIsProvenanceOpen(true)}>History</button>
                <button className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200" onClick={() => handleSave(content)}>Save</button>
            </div>
        </header>
        <div className="flex-1 overflow-hidden relative">
             <Editor initialContent={content} onChange={setContent} onSave={handleSave} />
        </div>
      </div>
      <ContextSidebar content={content} />
      <ProvenanceView filePath="chapter-001.md" isOpen={isProvenanceOpen} onClose={() => setIsProvenanceOpen(false)} />

      {isGraphOpen && (
        <div className="absolute inset-0 bg-white z-40 flex flex-col">
            <div className="flex justify-between items-center p-4 border-b bg-gray-50">
                <h2 className="text-xl font-bold">Relationship Graph</h2>
                <button onClick={() => setIsGraphOpen(false)} className="text-gray-500 font-bold px-4">Close</button>
            </div>
            <div className="flex-1 overflow-hidden">
                 <GraphView />
            </div>
        </div>
      )}

      {isSuggestionOpen && <SuggestionPanel issues={issues} aiIssues={aiIssues} isOpen={isSuggestionOpen} onClose={() => setIsSuggestionOpen(false)} />}

      {isSettingsOpen && <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />}
    </div>
  );
}

export default App;
