import type { Metadata } from "next";
import { Pixelify_Sans } from "next/font/google";
import CinemaScene from "@/components/cinema/CinemaScene";

/** Chunky pixel face for the painted-style LUNA_OS; ASCII art keeps the monospace font. */
const pixelify = Pixelify_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-lofi",
});

export const metadata: Metadata = {
  title: "Christopher Luna — Software Engineer (v2)",
  robots: { index: false, follow: false },
};

/** v2 preview: the lo-fi pixel desk. Unlinked; reachable via the dev switch. */
export default function V2Page() {
  return (
    <main className={pixelify.variable}>
      <h1 className="sr-only">Christopher Luna — Software Engineer Portfolio</h1>
      <CinemaScene />
    </main>
  );
}
