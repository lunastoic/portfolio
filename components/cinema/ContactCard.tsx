"use client";

import RetroWindow from "@/components/monitor/RetroWindow";

/** How to reach me, one row each. A row without a link (an account not added yet) isn't shown. */
const ROWS: { label: string; value: string; href: string | null }[] = [
  { label: "EMAIL", value: "Luna_Christopher98@hotmail.com", href: "mailto:Luna_Christopher98@hotmail.com" },
  { label: "GITHUB", value: "github.com/lunastoic", href: "https://github.com/lunastoic" },
  { label: "LINKEDIN", value: "linkedin.com/in/christopher-luna-a96324273", href: "https://www.linkedin.com/in/christopher-luna-a96324273" },
];

/**
 * CONTACT.EXE on the desk's computer: a business card, not a form. Name and title up top,
 * where I am, then each way to reach me as a link.
 */
export default function ContactCard({ onClose }: { onClose: () => void }) {
  return (
    <RetroWindow title="CONTACT.EXE" onClose={onClose}>
      <div className="app-content lofi-card">
        <div className="lofi-card__head">
          <p className="lofi-card__name">CHRISTOPHER LUNA</p>
          <p className="lofi-card__title">SOFTWARE ENGINEER</p>
          <p className="lofi-card__place">ANAHEIM, CA 92806</p>
        </div>
        <dl className="lofi-card__rows">
          {ROWS.filter((r) => r.href).map((r) => (
            <div key={r.label} className="lofi-card__row">
              <dt>{r.label}</dt>
              <dd>
                <a
                  href={r.href!}
                  {...(r.href!.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}
                >
                  {r.value}
                </a>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </RetroWindow>
  );
}
