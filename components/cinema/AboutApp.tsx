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
 * The desk computer's About Me window: a profile card on the left (name, role, where, school) and the story on the
 * right: my story in my own words, what I build, my skills grouped, and who I am outside of coding. On a narrow
 * screen the card sits on top.
 */
export default function AboutApp({ onClose }: { onClose: () => void }) {
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
            <li>Orange County, CA</li>
            <li>B.S. Computer Science</li>
            <li>
              <span className="about__csu">CSU</span> <span className="about__dh">Dominguez Hills</span>
            </li>
            <li>First-generation graduate</li>
          </ul>
        </aside>

        <div className="about__body">
          <section>
            <h3 className="about__h about__h--hello">Hey, I&apos;m Christopher!</h3>
            <p>
              I&apos;m a Computer Science graduate from <strong>
                <span className="about__csu">California State University,</span>{" "}
                <span className="about__dh">Dominguez Hills</span> (<span className="about__csu">CSU</span>
                <span className="about__dh">DH</span>)
              </strong>
              ,
              where I earned my Bachelor of Science in Computer Science.
            </p>
            <p>
              I&apos;ve always been fascinated by technology and figuring out how things work. Growing up, I loved putting
              things together, especially the LEGO sets my parents would get me. There was always something satisfying
              about starting with a bunch of individual pieces and slowly watching them change from an idea into a real
              thing. I think that&apos;s where my interest in programming really started. I still build things piece by
              piece, just with code now. The only difference is LEGO always came with instructions and a really nice
              picture of how it&apos;s supposed to look.
            </p>
            <p>
              That&apos;s what I enjoy most about programming: being able to take an idea, especially one that could solve
              a real-world problem, and figure out how to bring it to life. Just like building with LEGO, you start with an
              idea, experiment with different pieces, make mistakes along the way, and eventually create something that
              actually works.
            </p>
            <p>
              Since graduating, I&apos;ve been working on a variety of personal projects, from building full-stack websites
              for small businesses to developing mobile apps and experimenting with creative web experiences. I
              enjoy both the technical and creative sides of development, especially finding ways to make websites and
              applications feel unique, interactive, and easy to use.
            </p>
            <p>
              I&apos;m someone who enjoys learning new things, challenging myself, and finding creative ways to bring my
              ideas to life. Whether I&apos;m working on a new project, exploring something I&apos;ve never tried before, or
              simply spending time with the people I care about, I always try to enjoy the process.
            </p>
          </section>

          <section>
            <h3 className="about__h">What I've built</h3>
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
            <h3 className="about__h">Outside of coding</h3>
            <p>
              <strong>There&apos;s a lot more to me than just sitting behind a computer all day.</strong>
            </p>
            <p>
              I love spending quality time with my family, hanging out with friends, and being with my dog, Tessie, who
              is a Siberian husky mixed with a Welsh corgi. I also enjoy video games such as Battlefield, Minecraft and
              some Call of Duty here and there but mostly been on the Battlefield grind for when I do have spare time.
            </p>
            <p>
              Apart from gaming, my favorite movie of all time is <em>Interstellar</em>. There&apos;s something about its
              combination of science, space exploration, storytelling, and the unknown that has always stuck with me.
            </p>
          </section>

          <p className="about__signoff">I&apos;m still learning, still building, and always looking forward to what&apos;s next.</p>
        </div>
      </div>
    </RetroWindow>
  );
}
