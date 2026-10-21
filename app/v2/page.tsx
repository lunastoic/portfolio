import type { Metadata } from "next";
import { Oxanium } from "next/font/google";
import CinemaScene from "@/components/cinema/CinemaScene";

/** A clean, squared, slightly futuristic face for every word in the room: the screen, the
 *  notes, the decks, the poster and the book spines. ASCII art keeps the monospace font. */
const oxanium = Oxanium({
  subsets: ["latin"],
  variable: "--font-lofi",
});

export const metadata: Metadata = {
  title: "Christopher Luna — Software Engineer (v2)",
  robots: { index: false, follow: false },
};

/** v2 preview: the lo-fi pixel desk. Unlinked; reachable via the dev switch. */
export default function V2Page() {
  return (
    <main className={oxanium.variable}>
      <h1 className="sr-only">Christopher Luna — Software Engineer Portfolio</h1>
      <CinemaScene />
    </main>
  );
}
