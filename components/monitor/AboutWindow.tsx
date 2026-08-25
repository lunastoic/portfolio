"use client";

import RetroWindow from "./RetroWindow";

/** ABOUT.EXE — intro, interests, tech, education. Edit the text blocks freely. */
export default function AboutWindow({ onClose }: { onClose: () => void }) {
  return (
    <RetroWindow title="ABOUT.EXE" onClose={onClose}>
      <div className="app-content">
        <h2 className="app-heading">&gt; WHOAMI</h2>
        <p>
          Hi, I&apos;m Christopher Luna — a software engineer who likes building
          things people actually use. I care about clean interfaces, solid
          logic underneath, and the small details that make software feel good.
        </p>

        <h2 className="app-heading">&gt; INTERESTS</h2>
        <p>
          Full stack web development, mobile apps, game-like experiences, and
          algorithmic problems — from booking flows to drone pathfinding.
        </p>

        <h2 className="app-heading">&gt; WHAT I BUILD</h2>
        <ul className="app-list">
          <li>Full stack websites for real businesses</li>
          <li>Mobile apps and games</li>
          <li>Front ends that are fast and responsive</li>
          <li>Optimization and algorithm-driven tools</li>
        </ul>

        <h2 className="app-heading">&gt; TECH</h2>
        <p className="app-tags">
          {[
            "TypeScript",
            "JavaScript",
            "React",
            "Next.js",
            "React Native",
            "Node.js",
            "Python",
            "HTML/CSS",
            "Git",
          ].map((t) => (
            <span key={t} className="app-tag">
              [{t}]
            </span>
          ))}
        </p>

        <h2 className="app-heading">&gt; EDUCATION</h2>
        <p>
          B.S. Computer Science
          <br />
          California State University, Dominguez Hills
        </p>

        <h2 className="app-heading">&gt; STYLE</h2>
        <p>
          Ship code. Test it. Repeat. Powered by dark roast coffee and a
          healthy respect for the terminal.
        </p>
      </div>
    </RetroWindow>
  );
}
