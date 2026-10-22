# Pixel-art asset brief: v2 desk room

Generate everything as **true pixel art** at the sizes below (1 pixel = 1 pixel, no anti-aliasing, no soft glows,
no gradients: flat colour bands, dark outlines, a limited palette shared by every asset). Style: cozy lo-fi
night desk, warm wood and orange wall, green/teal accents, like the reference mockup
(`scripts/art/mockup.png`). Every asset except the background on a **transparent background**, PNG.

Scene canvas: **512 x 252 px** (about 2:1, so a full-screen browser is covered). The site scales it up with
hard edges. Positions are the asset's top-left corner on that canvas, approximate; I'll align them.

## Background
| File | Size | What |
|---|---|---|
| `bg.png` | 512 x 252 | The empty closet: back wall, a vertical inside corner on each side (left one at x = 50, right one at x = 465), darker side walls past them, the wood desk fitted wall to wall (its back edge at y = 211, front edge at the bottom). **No objects.** Lamp on: a warm pool of light on the wall and desk round the lamp, in flat bands. |
| `bg-off.png` | 512 x 252 | Same, lamp off: no warm pool, the room darker and cooler, a little green from the monitor. |

## Things on the wall (static)
| File | Size | Position | What |
|---|---|---|---|
| `deck-top.png` | 176 x 36 | 162, 2 | Skateboard deck, dark green face, **blank** (the site writes the name on it). |
| `deck-bottom.png` | 176 x 36 | 162, 41 | Skateboard deck, dusty rose face, **blank** (the site writes the school on it). |
| `poster.png` | 34 x 44 | 382, 82 | Framed night poster: purple sky, crescent moon, stars, teal mountains, pines. |
| `headset.png` | 34 x 60 | 452, 38 | Black over-ear headset hanging on a wall hook, green logo on the cup, cable hanging down. |

## Things on the desk (static)
| File | Size | Position | What |
|---|---|---|---|
| `monitor.png` | 114 x 82 | 194, 88 | Chunky CRT monitor, orange-rimmed bezel. **The glass must be a plain dark-green rectangle** (the site puts the live screen there): glass at 13, 8 inside the asset, 98 x 64. |
| `books.png` | 106 x 34 | 198, 170 | Three hardcover books stacked under the monitor (green, navy, red). **Blank spines** (the site writes the titles). |
| `keyboard.png` | 140 x 24 | 186, 216 | Full-size mechanical keyboard, dark green keys, slight top-down angle. |
| `notebook.png` | 74 x 28 | 12, 218 | Spiral notepad with a pen across it. |
| `pencil-cup.png` | 20 x 30 | 66, 186 | Cat-face pencil cup with 3 pens. Also the 3 pens as separate files `pen-1.png`, `pen-2.png`, `pen-3.png` on the same 20 x 30 canvas (they rattle). |
| `mousepad.png` | 72 x 22 | 312, 220 | Dark mousepad. |
| `mouse.png` | 22 x 14 | 340, 222 | Black wireless mouse. |
| `xbox.png` | 72 x 26 | 342, 184 | Xbox One console, white lit logo. |
| `controller.png` | 46 x 24 | 432, 214 | Black Xbox One controller, coloured ABXY, cable to the headset. |

## Live things (animated by the site)
| File | Size | Position | States / notes |
|---|---|---|---|
| `lamp-on.png`, `lamp-off.png` | 68 x 128 | 16, 87 | Stained-glass table lamp on a bronze stand with a pull chain. On: shade glowing. Off: shade dark amber. |
| `mug.png` | 40 x 52 | 115, 167 | Green mug with an orange crescent moon, on a cork coaster. Separate `steam.png` (16 x 20) above it: 2 to 3 light wisps. |
| `note-1.png` … `note-7.png` | 30 x 30 | 76, 89 | Square sticky note with a curled corner, **blank** (the site writes on it). Colours: green, orange, amber, pink, cream, green, orange. |
| `plant.png` | 62 x 100 | 237, 120 | Leafy plant in a terracotta pot (it sways from the pot's base). |
| `lava-on.png`, `lava-off.png` | 18 x 60 | 434, 150 | Lava lamp: silver cap and base, pink liquid with orange wax. On: lit. Off: dark. |

## When you have them
Put them in `scripts/art/pixel/` with these names. Missing ones are fine; tell me which you have and I'll
wire those in first.
