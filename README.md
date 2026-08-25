# Christopher Luna — Retro Terminal Portfolio

An interactive POV desk-scene portfolio: Matrix green / black terminal aesthetic,
with a retro monitor ("LUNA OS") as the main navigation hub and interactive desk
objects (coffee mug with ASCII steam, lamp, alarm clock, tower, plant, heart widget).

Built with Next.js (App Router) + TypeScript. No backend, no database.

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000

Production build: `npm run build && npm start`

## Where to edit content

| Content | File |
| --- | --- |
| Project list (titles, descriptions, tech, features, links) | `data/projects.ts` |
| About text | `components/monitor/AboutWindow.tsx` |
| Resume content | `components/monitor/ResumeWindow.tsx` |
| Contact links (GitHub / LinkedIn / email) | `components/monitor/ContactWindow.tsx` |
| Wall plaques (name / degree) | `components/room/IdentityPanels.tsx` |
| Boot sequence text | `components/monitor/BootSequence.tsx` |
| Popup messages (clock, plant, tower, heart) | `components/monitor/Monitor.tsx` (`POPUP_CONTENT`) |
| Colors / fonts / CRT effects | `app/globals.css` |
| Desk scene layout | `components/room/room.css` |
| Monitor UI styles | `components/monitor/monitor.css` |

## Placeholders to replace

- **Resume PDF** — drop your file at `public/resume/Christopher_Luna_Resume.pdf`
  (the RESUME window's download button already points there).
- **GitHub / Live Demo links** — set real URLs in `data/projects.ts`
  (`"#"` renders as a disabled placeholder button).
- **GitHub / LinkedIn profile links** — in `components/monitor/ContactWindow.tsx`.
- **Project screenshots** — add images to `public/` and set `screenshot` on a
  project in `data/projects.ts` (e.g. `"/screenshots/blackjack.png"`).
- **Contact form backend** — currently client-side only ("MESSAGE QUEUED."); wire
  the submit handler in `ContactWindow.tsx` to a service when ready.

## Structure

```
app/                  layout, page, global styles (tokens, CRT overlay, keyframes)
components/
  room/               desk scene: DeskScene (state owner), Lamp, Xbox, CoffeeCup,
                      Steam, ClockDevice, Tower, Shelves, IdentityPanels, room.css
  monitor/            LUNA OS: Monitor, BootSequence, MainMenu, RetroWindow,
                      About/Projects/ProjectDetail/Resume/Contact/Coffee windows
  ui/                 PixelButton, Tooltip, StatusPopup, useReducedMotion, ui.css
data/projects.ts      all five projects (single source of truth)
public/resume/        put the resume PDF here
```

Accessibility: all desk objects are real buttons with ARIA labels and visible
focus states, ESC closes windows/popups, and `prefers-reduced-motion` disables
the boot typing, steam animation, flicker, and blinking.
