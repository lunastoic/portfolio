# Christopher Luna — Lo-fi Pixel Desk Portfolio

An interactive pixel-art desk room: a painted lo-fi workspace with a lamp, lava
lamp, mug, plant, Xbox and headset, and a desk computer ("LUNA_OS") that holds
the About, Projects, Resume, Contact and Games windows.

Built with Next.js (App Router) + TypeScript and plain CSS. No backend, no database.

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
| About text | `components/cinema/AboutApp.tsx` |
| Projects window | `data/deskProjects.ts` |
| Resume window (and its project list) | `components/monitor/ResumeWindow.tsx`, `data/projects.ts` |
| Contact links | `components/cinema/ContactCard.tsx` |
| "About this site" window | `components/cinema/InfoApp.tsx` |
| Resume PDF | `public/resume/Christopher_Luna_Resume.pdf` |

## Structure

```
app/                  layout, page, global styles (tokens, keyframes)
components/
  cinema/             the room: CinemaScene (scene + props), LofiOS (desk computer),
                      the app windows, Pong, lava lamp, steam, cinema.css
  monitor/            RetroWindow (window chrome), ResumeWindow, monitor.css
  ui/                 PixelButton, ui.css
data/                 deskProjects.ts (Projects window), projects.ts (resume)
public/cinema/        the room's artwork (built by the scripts)
public/props/         pixel prop drafts the art scripts draw from
scripts/              asset pipeline for the room artwork
```
