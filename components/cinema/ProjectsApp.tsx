"use client";

import { useEffect, useRef, useState } from "react";
import RetroWindow from "@/components/monitor/RetroWindow";
import { deskProjects } from "@/data/deskProjects";

const initials = (title: string) =>
  title
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

/**
 * The desk computer's Projects window, laid out like a Mac app: the projects down a sidebar, the picked one's
 * details beside it (what it is, the problem and the result, what I built, and the stack, grouped). Up and down
 * arrows flip between projects. On a narrow screen the sidebar becomes a row of chips across the top.
 */
export default function ProjectsApp({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const detailRef = useRef<HTMLDivElement>(null);
  const p = deskProjects[index];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const n = deskProjects.length;
      setIndex((i) => (i + (e.key === "ArrowDown" ? 1 : n - 1)) % n);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // each project starts from its top
  useEffect(() => {
    detailRef.current?.scrollTo({ top: 0 });
  }, [index]);

  return (
    <RetroWindow title="Projects" onClose={onClose} className="proj-window">
      <div className="proj">
        <nav className="proj__side" aria-label="Projects">
          <p className="proj__side-head">Built solo · AI-assisted</p>
          <ul className="proj__list">
            {deskProjects.map((q, i) => (
              <li key={q.id}>
                <button
                  type="button"
                  className={`proj__item ${i === index ? "proj__item--on" : ""}`}
                  aria-current={i === index || undefined}
                  onClick={() => setIndex(i)}
                >
                  <span className="proj__tile" style={{ background: q.tile }} aria-hidden="true">
                    {initials(q.title)}
                  </span>
                  <span className="proj__item-text">
                    <span className="proj__item-name">{q.title}</span>
                    <span className="proj__item-kind">{q.kind.split(" · ")[0]}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <article className="proj__detail" ref={detailRef} aria-live="polite">
          <header className="proj__head">
            <span className="proj__tile proj__tile--big" style={{ background: p.tile }} aria-hidden="true">
              {initials(p.title)}
            </span>
            <div>
              <h2 className="proj__title">{p.title}</h2>
              <p className="proj__kind">
                {p.kind} <span className="proj__status">{p.status}</span>
              </p>
            </div>
          </header>

          <p className="proj__summary">{p.summary}</p>

          <div className="proj__pr">
            <div className="proj__card">
              <h3 className="proj__label">Problem</h3>
              <p>{p.problem}</p>
            </div>
            <div className="proj__card">
              <h3 className="proj__label">Result</h3>
              <p>{p.result}</p>
            </div>
          </div>

          <h3 className="proj__label">What I built</h3>
          <ul className="proj__built">
            {p.built.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>

          <h3 className="proj__label">Tech stack</h3>
          <dl className="proj__tech">
            {p.tech.map((t) => (
              <div key={t.group} className="proj__tech-row">
                <dt>{t.group}</dt>
                <dd>
                  {t.items.map((it) => (
                    <span key={it} className="proj__badge">
                      {it}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>

          <div className="proj__links">
            {p.links.map((l) => (
              <a key={l.href} className="proj__link" href={l.href} target="_blank" rel="noreferrer">
                {l.label} ↗
              </a>
            ))}
          </div>
        </article>
      </div>
    </RetroWindow>
  );
}
