"use client";

import { useEffect, useState } from "react";
import { projects } from "@/data/projects";
import PixelButton from "@/components/ui/PixelButton";
import RetroWindow from "./RetroWindow";

const RESUME_URL = "/resume/Christopher_Luna_Resume.pdf";

// Mirrors the PDF — keep these in sync when the resume changes.
const resumeProjects = [
  {
    title: "Blackjack Card Counting App",
    text: "iOS app that teaches card counting through simulated gameplay.",
    tools: "Swift, SwiftUI, Xcode",
  },
  {
    title: "Blackjack Card Counting Website",
    text: "Web version of the app with interactive graphics and real-time stats.",
    tools: "React, Redux, D3.js, CanvasJS, Node.js, Express.js, MongoDB",
  },
  {
    title: "Sport Shoe Database",
    text: "Group senior project designing and querying a structured SQL database with business rules, ER diagrams, and custom entities/tables.",
    tools: "SQL, MySQL Workbench, ER Modeling",
  },
  {
    title: "Student Portal Website",
    text: "Full-stack site for student login, assignments, and schedule management.",
    tools: "React, Django, REST API",
  },
  {
    title: "3D Drone Simulator",
    text: "Simulates drone routing and 3D visualization for path planning.",
    tools: "Java, JavaFX, Eclipse",
  },
];

const experience = [
  {
    role: "Designated School Official",
    place: "Living Water University",
    city: "Santa Ana, CA",
    dates: "October 2025 to Present",
    bullets: [
      "Managed SEVIS records and Form I-20 processing for F-1/F-2 students, including transfers, endorsements, CPT, program updates, and dependent requests.",
      "Advised students on F-1 compliance requirements and coordinated with campus departments to resolve documentation, enrollment, and immigration-related matters.",
    ],
  },
  {
    role: "Stock Supervisor",
    place: "Vans",
    city: "Orange, CA",
    dates: "July 2018 - February 2026",
    bullets: [
      "Coordinated schedules & task assignments, effectively balancing personnel & resources allocation.",
      "Ensured accurate product scanning and integration into the inventory system.",
      "Managed overnight shifts to meet specific store requirements.",
      "Protected company assets & complied with safety, security & shrink policies",
      "Coached team members to elevate performance during peak sale seasons",
    ],
  },
];

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

        <p>
          <a href="mailto:luna_christopher98@hotmail.com">luna_christopher98@hotmail.com</a>
        </p>

        <h2 className="app-heading">&gt; EDUCATION</h2>
        <p>
          B.S., FOCUS ON COMPUTER SCIENCE — 2025
          <br />
          <span className="resume-gap" />
          California State University, Dominguez Hills — Carson, CA
        </p>

        <h2 className="app-heading">&gt; PROJECTS</h2>
        <ul className="app-list resume-list">
          {resumeProjects.map((p) => (
            <li key={p.title}>
              <strong>{p.title}</strong> — {p.text}
              <br />
              Tools: {p.tools}
            </li>
          ))}
          {projects.map((p) => (
            <li key={p.id}>
              <strong>{p.title}</strong> — {p.tagline}
            </li>
          ))}
        </ul>

        <h2 className="app-heading">&gt; WORK EXPERIENCE</h2>
        <ul className="app-list resume-list">
          {experience.map((job) => (
            <li key={job.role}>
              <strong>{job.role}</strong> — {job.place}, {job.city}
              <br />
              {job.dates}
              <ul className="resume-bullets">
                {job.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>

        <h2 className="app-heading">&gt; SKILLS &amp; QUALIFICATIONS</h2>
        <ul className="app-list resume-list">
          <li>
            Languages &amp; Frameworks: Python, Java, SQL, Swift, JavaScript, TypeScript, React, Next.js, React
            Native, Expo
          </li>
          <li>Tools &amp; Platforms: Git, GitHub, Vercel, Prisma, PostgreSQL, Neon, Expo, Cursor, Claude Code</li>
          <li>
            Development Skills: Web/mobile development, responsive UI, database management, API integration,
            authentication, debugging, and deployment
          </li>
          <li>
            Professional Skills: Technical troubleshooting, communication, documentation, student support,
            compliance, and cross-department coordination
          </li>
        </ul>
      </div>
    </RetroWindow>
  );
}
