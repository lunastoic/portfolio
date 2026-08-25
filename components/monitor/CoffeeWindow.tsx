"use client";

import Steam from "@/components/room/Steam";
import RetroWindow from "./RetroWindow";

/** COFFEE MODE — popup opened by clicking the mug on the desk. */
export default function CoffeeWindow({ onClose }: { onClose: () => void }) {
  return (
    <RetroWindow title="COFFEE MODE" onClose={onClose} className="retro-window--popup">
      <div className="app-content coffee-mode">
        <div className="coffee-mode__art">
          <Steam size="big" />
          <pre aria-hidden="true">{`  .---------.
  |#########|--.
  |#########|  |
  |#########|--'
  '---------'
   \\_______/`}</pre>
        </div>

        <p className="coffee-mode__headline">FUEL FOR CODE.</p>
        <p>
          Coffee powers late nights,
          <br />
          early mornings,
          <br />
          and everything in between.
        </p>

        <div className="coffee-mode__brew">
          <p className="app-heading">&gt; CURRENT BREW</p>
          <p>
            <span className="coffee-mode__dot" aria-hidden="true">
              ●
            </span>{" "}
            DARK ROAST
          </p>
          <p className="coffee-mode__specs">STRONG • SMOOTH • FOCUSED</p>
        </div>
      </div>
    </RetroWindow>
  );
}
