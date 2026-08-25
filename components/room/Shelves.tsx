"use client";

import Tooltip from "@/components/ui/Tooltip";
import "./room.css";

interface ShelvesProps {
  side: "left" | "right";
  onPlantClick?: () => void;
  onHeartClick?: () => void;
}

/**
 * Wall shelves + decor. Left: plant, books, poster, sticky notes.
 * Right: robot, globe, books, hanging plant, heart widget.
 */
export default function Shelves({ side, onPlantClick, onHeartClick }: ShelvesProps) {
  if (side === "left") {
    return (
      <div className="shelf-zone shelf-zone--left dimmable">
        <div className="shelf">
          <button
            type="button"
            className="plant has-tooltip"
            onClick={onPlantClick}
            aria-label="Check plant status"
          >
            <Tooltip label="PLANT?" />
            <pre aria-hidden="true">{` \\|/
--*--
 /|\\
 |_|`}</pre>
          </button>
          <div className="book book--tall" aria-hidden="true">
            <span>ALGORITHMS</span>
          </div>
          <div className="book book--short" aria-hidden="true">
            <span>JS</span>
          </div>
          <div className="shelf__board" />
        </div>

        <div className="poster" aria-hidden="true">
          <pre>{`  ▲
 ▲ ▲ .`}</pre>
          <span>KEEP BUILDING</span>
        </div>

        <div className="stickies" aria-hidden="true">
          <div className="sticky">
            SHIP
            <br />
            CODE
            <br />
            REPEAT
          </div>
          <div className="sticky sticky--smile">:&#41;</div>
        </div>
      </div>
    );
  }

  return (
    <div className="shelf-zone shelf-zone--right dimmable">
      <div className="shelf">
        <pre className="robot" aria-hidden="true">{`  [▪]
 [o_o]
 /|█|\\`}</pre>
        <pre className="globe" aria-hidden="true">{` .-.
(◠#)
 '-'`}</pre>
        <div className="shelf__board" />
      </div>

      <div className="shelf shelf--books">
        <div className="book book--tall" aria-hidden="true">
          <span>CLEAN CODE</span>
        </div>
        <div className="book book--tall" aria-hidden="true">
          <span>DESIGN PATTERNS</span>
        </div>
        <div className="book book--short" aria-hidden="true">
          <span>C++</span>
        </div>
        <pre className="hanging-plant" aria-hidden="true">{`\\|/
(_)
 )
(  )`}</pre>
        <div className="shelf__board" />
      </div>

      <button
        type="button"
        className="heart-widget has-tooltip"
        onClick={onHeartClick}
        aria-label="Check passion status"
      >
        <Tooltip label="STATUS" />
        <span aria-hidden="true">♥</span>
      </button>
    </div>
  );
}
