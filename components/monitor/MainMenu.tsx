"use client";

import type { AppId } from "@/components/types";
import "./monitor.css";

const MENU_ITEMS: { id: AppId; label: string; icon: string; accent: string }[] = [
  { id: "about", label: "ABOUT", icon: ">_", accent: "var(--accent-about)" },
  { id: "projects", label: "PROJECTS", icon: "</>", accent: "var(--accent-projects)" },
  { id: "resume", label: "RESUME", icon: "[≡]", accent: "var(--accent-resume)" },
  { id: "contact", label: "CONTACT", icon: "@", accent: "var(--accent-contact)" },
];

/** Home screen of LUNA OS: welcome header + the four app icons. */
export default function MainMenu({ onOpen }: { onOpen: (app: AppId) => void }) {
  return (
    <div className="main-menu">
      <p className="main-menu__welcome">WELCOME!</p>
      <p className="main-menu__hint">
        SELECT AN OPTION <span className="cursor-blink" aria-hidden="true" />
      </p>
      <nav aria-label="Portfolio sections">
        <ul className="main-menu__grid">
          {MENU_ITEMS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="main-menu__item"
                style={{ "--item-accent": item.accent } as React.CSSProperties}
                onClick={() => onOpen(item.id)}
              >
                <span className="main-menu__icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="main-menu__label">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <p className="main-menu__tip" aria-hidden="true">
        TIP: THE DESK IS INTERACTIVE. TRY THE MUG.
      </p>
    </div>
  );
}
