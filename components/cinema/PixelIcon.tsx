/** Tiny pixel glyphs for the lo-fi menu, drawn from bitmaps in currentColor. */
const ICONS = {
  person: [
    "...####...",
    "..######..",
    "..######..",
    "..######..",
    "...####...",
    ".########.",
    "##########",
    "##########",
    "##########",
    "##########",
  ],
  folder: [
    ".#####......",
    "#.....#.....",
    "#......#####",
    "#..........#",
    "############",
    "#..........#",
    "#..........#",
    "#..........#",
    "#..........#",
    "############",
  ],
  document: [
    "#######...",
    "#.....##..",
    "#.....#.#.",
    "#.....####",
    "#........#",
    "#.#####..#",
    "#........#",
    "#.#####..#",
    "#........#",
    "#.#####..#",
    "#........#",
    "##########",
  ],
  mail: [
    "############",
    "#..........#",
    "##........##",
    "#.##....##.#",
    "#...####...#",
    "#..........#",
    "#..........#",
    "#..........#",
    "############",
  ],
  gamepad: [
    "..##....##..",
    ".##########.",
    "############",
    "##.#####.#.#",
    "#...###.#.##",
    "##.#####.#.#",
    "############",
    "####....####",
    ".##......##.",
  ],
} as const;

export type IconName = keyof typeof ICONS;

export default function PixelIcon({ name }: { name: IconName }) {
  const rows = ICONS[name];
  const h = rows.length;
  const w = rows[0].length;
  return (
    <svg className="lofi__icon" viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" aria-hidden="true">
      {rows.flatMap((row, y) =>
        [...row].map((c, x) =>
          c === "#" ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="currentColor" /> : null
        )
      )}
    </svg>
  );
}
