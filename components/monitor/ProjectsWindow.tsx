"use client";

import { useEffect, useState } from "react";
import { projects, type Project } from "@/data/projects";
import { useReducedMotion } from "@/components/ui/useReducedMotion";
import RetroWindow from "./RetroWindow";
import ProjectDetailWindow from "./ProjectDetailWindow";

type ViewState =
  | { mode: "list" }
  | { mode: "loading"; project: Project }
  | { mode: "detail"; project: Project };

const LOAD_MS = 550;

/** PROJECTS.EXE — retro file browser list → loading bar → project detail. */
export default function ProjectsWindow({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<ViewState>({ mode: "list" });
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (view.mode !== "loading") return;
    const t = setTimeout(
      () => setView({ mode: "detail", project: view.project }),
      reducedMotion ? 0 : LOAD_MS
    );
    return () => clearTimeout(t);
  }, [view, reducedMotion]);

  const title =
    view.mode === "list" ? "PROJECTS.EXE — C:\\PROJECTS" : "PROJECTS.EXE";

  return (
    <RetroWindow title={title} onClose={onClose}>
      {view.mode === "list" && (
        <div className="app-content">
          <p className="file-browser__header" aria-hidden="true">
            DIR OF C:\PROJECTS — {projects.length} FILE(S)
          </p>
          <ul className="file-browser" aria-label="Project files">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="file-browser__row"
                  onClick={() => setView({ mode: "loading", project: p })}
                >
                  <span className="file-browser__type" aria-hidden="true">
                    [DIR]
                  </span>
                  <span className="file-browser__name">{p.fileName}</span>
                  <span className="file-browser__open" aria-hidden="true">
                    &lt;OPEN&gt;
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="file-browser__footer" aria-hidden="true">
            SELECT A FILE TO OPEN <span className="cursor-blink" />
          </p>
        </div>
      )}

      {view.mode === "loading" && (
        <div className="app-content loading-screen" role="status">
          <p>OPENING {view.project.fileName}...</p>
          <div className="loading-track" aria-hidden="true">
            <div className="loading-fill" />
          </div>
        </div>
      )}

      {view.mode === "detail" && (
        <ProjectDetailWindow
          project={view.project}
          onBack={() => setView({ mode: "list" })}
        />
      )}
    </RetroWindow>
  );
}
