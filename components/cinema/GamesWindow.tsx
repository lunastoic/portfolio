"use client";

import RetroWindow from "@/components/monitor/RetroWindow";
import Pong from "./Pong";

export type GameId = "pong" | "doom";

// Doom lives on its own site (lunastoic/doom on GitHub Pages) and only loads when it's opened
const DOOM_URL = "https://lunastoic.github.io/doom/";

const GAMES: { id: GameId; name: string; note: string; tile: string; art: string }[] = [
  { id: "pong", name: "Pong", note: "vs the computer", tile: "#3d73d6", art: "▮ · ▮" },
  { id: "doom", name: "DOOM", note: "first load ~30 MB", tile: "#b8321f", art: "DOOM" },
];

/**
 * The games folder: Pong and DOOM as two big icons. Opening one plays it right in the window. Pong is drawn here;
 * DOOM is a frame onto its own site, made only when it's opened and thrown away when it's closed, so it costs the
 * portfolio nothing until someone plays. "‹ Games" goes back to the folder, the × closes the lot.
 */
export default function GamesWindow({
  game,
  onGame,
  onClose,
}: {
  game: GameId | null;
  onGame: (g: GameId | null) => void;
  onClose: () => void;
}) {
  const title = game === "pong" ? "PONG" : game === "doom" ? "DOOM" : "GAMES";
  return (
    <RetroWindow title={title} onClose={onClose} className="game-window">
      {game === null ? (
        <ul className="games" aria-label="Games">
          {GAMES.map((g) => (
            <li key={g.id}>
              <button type="button" className="games__item" onClick={() => onGame(g.id)}>
                <span className={`games__tile games__tile--${g.id}`} style={{ background: g.tile }} aria-hidden="true">
                  {g.art}
                </span>
                <span className="games__name">{g.name}</span>
                <span className="games__note">{g.note}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="game">
          <button type="button" className="game__back" onClick={() => onGame(null)}>
            ‹ Games
          </button>
          {game === "pong" && <Pong />}
          {game === "doom" && (
            <iframe className="game__frame" src={DOOM_URL} title="DOOM" allow="autoplay; fullscreen; gamepad" />
          )}
        </div>
      )}
    </RetroWindow>
  );
}
