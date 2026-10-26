/**
 * The projects shown in the desk computer's Projects window (v2). v1 keeps its own list in projects.ts.
 * Everything here is taken from the projects' repos; keep it to what the code actually does.
 */
export interface DeskProject {
  id: string;
  title: string;
  /** What kind of thing it is, and in what spirit it was built */
  kind: string;
  status: string;
  /** A colour for its icon in the sidebar */
  tile: string;
  summary: string;
  problem: string;
  result: string;
  built: string[];
  /** The stack, grouped (Frontend, Backend, Mobile, Testing…) */
  tech: { group: string; items: string[] }[];
  links: { label: string; href: string }[];
}

export const deskProjects: DeskProject[] = [
  {
    id: "muddy-paws",
    title: "Muddy Paws OC",
    kind: "Full-stack web app · Spec project",
    status: "Demo",
    tile: "#3fb37f",
    summary:
      "A booking platform for a local Orange County dog groomer, built on spec to show how the shop could move from phone calls to online scheduling.",
    problem: "Every appointment is booked by phone: no online scheduling, no reminders and no customer records.",
    result:
      "A working demo with customer accounts, online booking with conflict checks, automated reminders, a loyalty program and a full admin dashboard, ready to pitch to the business.",
    built: [
      "Customer portal: accounts, pet profiles, appointment history and online booking",
      "Booking engine that checks time-slot conflicts and assigns staff",
      "Admin dashboard for the day's schedule, check-in, customers, services, reviews and reports",
      "Loyalty points and coupons redeemed on appointments",
      "Email confirmations and reminders, with optional SMS",
      "Integration tests that run against a real Postgres database",
    ],
    tech: [
      { group: "Frontend", items: ["Next.js 15", "React", "TypeScript", "Tailwind CSS", "Motion"] },
      { group: "Backend", items: ["Next.js API routes", "PostgreSQL (Neon)", "Prisma", "Auth.js", "Zod"] },
      { group: "Services", items: ["Resend", "Twilio", "Vercel"] },
      { group: "Testing", items: ["Vitest", "Testcontainers"] },
    ],
    links: [{ label: "Live demo", href: "https://muddy-paws-oc-dev.vercel.app/" }],
  },
  {
    id: "luna-auto",
    title: "Luna Auto",
    kind: "Front-end website · Practice project",
    status: "Live demo",
    tile: "#d0473a",
    summary: "A premium one-page website for an auto repair shop, designed to turn visitors into booked appointments.",
    problem: "Local shop websites are often dated and hard to use on a phone, so customers leave before they call.",
    result: "A fast, responsive site with a clear path from services to contact, deployed on Vercel.",
    built: [
      "Interactive service explorer with tabs for Repair, Maintenance, Performance and Detailing",
      "Sticky navigation with an animated mobile menu",
      "Reusable components and a design system built on Tailwind v4 theme tokens",
      "All site content driven from one data file, so it's easy to update",
      "Scroll and tab animations, reviews, a process timeline and a contact form",
    ],
    tech: [
      { group: "Frontend", items: ["Next.js", "React", "TypeScript", "Tailwind CSS v4", "Motion", "Lucide icons"] },
      { group: "Deployment", items: ["Vercel"] },
    ],
    links: [{ label: "Live demo", href: "https://embee-motors-dev.vercel.app/" }],
  },
  {
    id: "blackjack",
    title: "Blackjack Card Counter",
    kind: "Mobile app · iOS & Android",
    status: "Coming soon to the App Store",
    tile: "#8c2a3a",
    summary:
      "A mobile trainer that teaches blackjack card counting step by step, from card values to keeping a running count at speed.",
    problem: "Card counting is hard to learn from a book: there's no feedback on whether you're counting right, or fast enough.",
    result: "A complete app with lessons, timed drills, quizzes and progress tracking, now being prepared for App Store release.",
    built: [
      "Lessons and guided levels that build the skill one step at a time",
      "Drills for card values, the running count and speed",
      "Flash and quiz modes, a daily shoe challenge and a weak-spot review",
      "Achievements and rewards, with progress saved on the device",
      "Haptics and sound for card-table feel",
    ],
    tech: [
      { group: "Mobile", items: ["React Native", "Expo", "Expo Router", "TypeScript"] },
      { group: "State & data", items: ["Zustand", "Zod", "AsyncStorage"] },
      { group: "UI", items: ["Reanimated", "Gesture Handler", "Expo Haptics", "Expo Audio"] },
      { group: "Testing", items: ["Jest"] },
    ],
    links: [{ label: "GitHub", href: "https://github.com/lunastoic/Blackjack_C_Counting_dev" }],
  },
  {
    id: "snack-run",
    title: "Snack Run",
    kind: "Mobile game · iPhone",
    status: "In testing",
    tile: "#d4a72c",
    summary: "A 2D top-down stealth game: sneak through an office tower after hours and steal the boss's legendary snack stash.",
    problem: "Make a stealth game that feels good with touch controls on a phone, with guards smart enough to be a real challenge.",
    result: "A complete five-floor story mode with guard AI, security cameras and saved progress, playable on iPhone.",
    built: [
      "Game engine with collision, raycast line of sight and vision cones",
      "Guard and boss AI that patrols, investigates noise and reacts to cameras",
      "Analog joystick with sneak, walk and sprint, stamina and noise",
      "Five data-driven levels with a story between floors",
      "Versioned save system that recovers from corrupted saves",
      "Headless test harness that checks every floor can be completed",
    ],
    tech: [
      { group: "Mobile", items: ["React Native", "Expo", "TypeScript"] },
      { group: "Graphics", items: ["React Native Skia", "Reanimated"] },
      { group: "State", items: ["Zustand", "AsyncStorage"] },
      { group: "Testing", items: ["Headless engine tests"] },
    ],
    links: [{ label: "GitHub", href: "https://github.com/lunastoic/snack-run" }],
  },
  {
    id: "luna-up-now",
    title: "Luna Up Now",
    kind: "iOS app · Swift",
    status: "In progress",
    tile: "#5b4fc4",
    summary:
      "A snooze-proof alarm. One alarm starts a Wake Guard session that keeps checking on you until you've proven you're up.",
    problem: "Normal alarms are easy to switch off half asleep and snooze straight through.",
    result: "The Wake Guard engine and app are built on Apple's new AlarmKit (iOS 26) and are being tested on a real iPhone.",
    built: [
      "Multi-stage wake session: a main challenge, a stay-awake check and a final confirmation",
      "Seeded math challenges that come back the same after the app relaunches",
      "Escalating follow-up alarms with stable IDs, capped and cleaned up automatically",
      "Sessions restored if the alarm is stopped without finishing",
      "Standard, Heavy Sleeper and Nuclear modes, plus alarm history",
      "Unit tests for the engine and the escalation logic",
    ],
    tech: [
      { group: "iOS", items: ["Swift", "SwiftUI", "AlarmKit", "App Intents", "UserNotifications"] },
      { group: "Testing", items: ["XCTest"] },
    ],
    links: [{ label: "GitHub", href: "https://github.com/lunastoic/LunaUpNow" }],
  },
];
