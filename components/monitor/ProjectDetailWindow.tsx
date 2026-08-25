"use client";

import Image from "next/image";
import type { Project } from "@/data/projects";
import PixelButton from "@/components/ui/PixelButton";

/** Detail view for one project, rendered inside PROJECTS.EXE. */
export default function ProjectDetailWindow({
  project,
  onBack,
}: {
  project: Project;
  onBack: () => void;
}) {
  return (
    <div className="app-content project-detail">
      <button type="button" className="project-detail__back" onClick={onBack}>
        &lt;&lt; BACK TO FILES
      </button>

      <h2 className="project-detail__title">{project.title}</h2>
      <p className="project-detail__tagline">{project.tagline}</p>

      {project.screenshot ? (
        <Image
          src={project.screenshot}
          alt={`${project.title} screenshot`}
          width={640}
          height={360}
          className="project-detail__screenshot"
        />
      ) : (
        <div className="project-detail__placeholder" role="img" aria-label="Screenshot placeholder">
          <pre aria-hidden="true">{`+----------------------------+
|                            |
|    [ IMG // SCREENSHOT ]   |
|    [     PENDING...    ]   |
|                            |
+----------------------------+`}</pre>
        </div>
      )}

      <h3 className="app-heading">&gt; DESCRIPTION</h3>
      <p>{project.description}</p>

      <h3 className="app-heading">&gt; TECH STACK</h3>
      <p className="app-tags">
        {project.tech.map((t) => (
          <span key={t} className="app-tag">
            [{t}]
          </span>
        ))}
      </p>

      <h3 className="app-heading">&gt; KEY FEATURES</h3>
      <ul className="app-list">
        {project.features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>

      <div className="project-detail__actions">
        <PixelButton href={project.githubUrl} variant="outline">
          GITHUB
        </PixelButton>
        <PixelButton href={project.liveUrl} variant="solid">
          LIVE DEMO
        </PixelButton>
      </div>
    </div>
  );
}
