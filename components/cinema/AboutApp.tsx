"use client";

import RetroWindow from "@/components/monitor/RetroWindow";

const WHAT_I_BUILD = [
  { title: "Full-stack web apps", text: "Booking platforms with accounts, databases, dashboards and email, built with Next.js and PostgreSQL." },
  { title: "Mobile apps & games", text: "iOS and Android apps in React Native and Expo, plus native iOS in Swift." },
  { title: "Fast, clean front ends", text: "Responsive sites that look good on any screen and load quickly." },
  { title: "Algorithms & logic", text: "Game AI, pathfinding and the problem solving underneath the interface." },
];

const SKILLS = [
  { group: "Languages", items: ["TypeScript", "JavaScript", "Python", "Swift", "Java", "C", "HTML/CSS"] },
  { group: "Frontend", items: ["React", "Next.js", "Tailwind CSS"] },
  { group: "Mobile", items: ["React Native", "Expo", "SwiftUI"] },
  { group: "Backend", items: ["Node.js", "PostgreSQL", "Prisma"] },
  { group: "Tools", items: ["Git", "GitHub", "Vercel", "Jest", "Vitest"] },
];

/**
 * The desk computer's About Me window: a profile card on the left (name, role, where, school, and buttons on to the
 * other apps) and the story on the right: a short intro, what I build, my skills grouped, and what I'm into away
 * from the keyboard. On a narrow screen the card sits on top.
 */
export default function AboutApp({
  onClose,
  onOpen,
}: {
  onClose: () => void;
  onOpen: (app: "projects" | "resume" | "contact") => void;
}) {
  return (
    <RetroWindow title="About Me" onClose={onClose} className="about-window">
      <div className="about">
        <aside className="about__card">
          <span className="about__avatar" aria-hidden="true">
            CL
          </span>
          <h2 className="about__name">Christopher Luna</h2>
          <p className="about__role">Software Engineer</p>
          <ul className="about__facts">
            <li>Anaheim, CA</li>
            <li>B.S. Computer Science</li>
            <li>CSU Dominguez Hills</li>
            <li>First-generation graduate</li>
          </ul>
          <div className="about__actions">
            <button type="button" className="about__btn about__btn--main" onClick={() => onOpen("projects")}>
              See my projects
            </button>
            <button type="button" className="about__btn" onClick={() => onOpen("resume")}>
              Resume
            </button>
            <button type="button" className="about__btn" onClick={() => onOpen("contact")}>
              Contact
            </button>
          </div>
        </aside>

        <div className="about__body">
          <section>
            <h3 className="about__h">Hi, I&apos;m Christopher</h3>
            <p className="about__lead">
              I&apos;m a software engineer who likes building things people actually use. I care about clean interfaces,
              solid logic underneath, and the small details that make software feel good.
            </p>
          </section>

          <section>
            <h3 className="about__h">What I build</h3>
            <div className="about__grid">
              {WHAT_I_BUILD.map((w) => (
                <div key={w.title} className="about__tile">
                  <p className="about__tile-title">{w.title}</p>
                  <p>{w.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="about__h">Skills</h3>
            <dl className="about__skills">
              {SKILLS.map((s) => (
                <div key={s.group} className="about__skill-row">
                  <dt>{s.group}</dt>
                  <dd>
                    {s.items.map((it) => (
                      <span key={it} className="proj__badge">
                        {it}
                      </span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h3 className="about__h">How I work</h3>
            <p>Ship it, test it, make it better. Powered by dark roast coffee and a healthy respect for the terminal.</p>
          </section>

          <section>
            <h3 className="about__h">Away from the keyboard</h3>
            <p>Gaming (Halo forever), anime and movies, music, and dogs.</p>
          </section>
        </div>
      </div>
    </RetroWindow>
  );
}
