import type { Metadata } from "next";
import { Inter, Oxanium } from "next/font/google";
import CinemaScene from "@/components/cinema/CinemaScene";

/** A clean, squared, slightly futuristic face for the room's words: the notes, the decks, the
 *  poster and the book spines. ASCII art keeps the monospace font. */
const oxanium = Oxanium({
  subsets: ["latin"],
  variable: "--font-lofi",
});

/** The desk computer's own face: a plain UI font, like a real Mac's. */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-ui",
});

export const metadata: Metadata = {
  title: "Christopher Luna — Software Engineer (v2)",
  robots: { index: false, follow: false },
};

/** v2 preview: the lo-fi pixel desk. Unlinked; reachable via the dev switch. */
export default function V2Page() {
  return (
    <main className={`${oxanium.variable} ${inter.variable}`}>
      <h1 className="sr-only">Christopher Luna — Software Engineer Portfolio</h1>
      <CinemaScene />
    </main>
  );
}
