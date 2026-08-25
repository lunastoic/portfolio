"use client";

import { useEffect, useState } from "react";
import { projects } from "@/data/projects";
import PixelButton from "@/components/ui/PixelButton";
import RetroWindow from "./RetroWindow";

const RESUME_URL = "/resume/Christopher_Luna_Resume.pdf";

/**
 * RESUME.EXE — on-screen resume, PDF download, and a read-only PDF viewer
 * that opens the file "on the computer".
 * Drop the real PDF at /public/resume/Christopher_Luna_Resume.pdf
 */
export default function ResumeWindow({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<"info" | "viewer">("info");
  const [fileStatus, setFileStatus] = useState<"unknown" | "ok" | "missing">("unknown");

  // Confirm the PDF actually exists before pointing an iframe at it.
  useEffect(() => {
    if (view !== "viewer" || fileStatus !== "unknown") return;
    fetch(RESUME_URL, { method: "HEAD" })
      .then((res) => {
        const type = res.headers.get("content-type") ?? "";
        setFileStatus(res.ok && type.includes("pdf") ? "ok" : "missing");
      })
      .catch(() => setFileStatus("missing"));
  }, [view, fileStatus]);

  if (view === "viewer") {
    return (
      <RetroWindow title="RESUME.PDF — READ ONLY" onClose={onClose}>
        <div className="app-content resume-viewer">
          <button
            type="button"
            className="project-detail__back"
            onClick={() => setView("info")}
          >
            &lt;&lt; BACK TO RESUME.EXE
          </button>

          {fileStatus === "unknown" && (
            <p role="status">
              OPENING RESUME.PDF... <span className="cursor-blink" aria-hidden="true" />
            </p>
          )}

          {fileStatus === "ok" && (
            <iframe
              className="resume-viewer__frame"
              src={`${RESUME_URL}#toolbar=0&navpanes=0`}
              title="Resume PDF, read-only view"
            />
          )}

          {fileStatus === "missing" && (
            <div className="resume-viewer__error" role="alert">
              <pre aria-hidden="true">{`+------------------------------+
|                              |
|   ERR: RESUME.PDF NOT FOUND  |
|                              |
+------------------------------+`}</pre>
              <p>
                DROP THE FILE AT
                <br />
                /public/resume/Christopher_Luna_Resume.pdf
              </p>
            </div>
          )}
        </div>
      </RetroWindow>
    );
  }

  return (
    <RetroWindow title="RESUME.EXE" onClose={onClose}>
      <div className="app-content">
        <div className="resume-download">
          <PixelButton href={RESUME_URL} download variant="solid">
            ↓ DOWNLOAD RESUME.PDF
          </PixelButton>
          <PixelButton onClick={() => setView("viewer")}>
            ▤ VIEW RESUME.PDF
          </PixelButton>
        </div>

        <h2 className="app-heading">&gt; EDUCATION</h2>
        <p>
          B.S. COMPUTER SCIENCE
          <br />
          California State University, Dominguez Hills
        </p>

        <h2 className="app-heading">&gt; TECHNICAL SKILLS</h2>
        <ul className="app-list">
          <li>Languages: TypeScript, JavaScript, Python, HTML, CSS</li>
          <li>Front End: React, Next.js, Responsive Design</li>
          <li>Mobile: React Native, mobile game development</li>
          <li>Back End: Node.js, REST APIs</li>
          <li>Tools: Git, GitHub, VS Code</li>
        </ul>

        <h2 className="app-heading">&gt; PROJECTS</h2>
        <ul className="app-list">
          {projects.map((p) => (
            <li key={p.id}>
              <strong>{p.title}</strong> — {p.tagline}
            </li>
          ))}
        </ul>

        <h2 className="app-heading">&gt; EXPERIENCE</h2>
        <ul className="app-list">
          <li>
            {/* Placeholder — replace with real experience entries */}
            Software Engineering Projects — Independent &amp; Academic
            <br />
            Designed, built, and shipped full stack, front end, and mobile
            applications end to end.
          </li>
        </ul>
      </div>
    </RetroWindow>
  );
}
