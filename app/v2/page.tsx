import type { Metadata } from "next";
import CinemaScene from "@/components/cinema/CinemaScene";

export const metadata: Metadata = {
  title: "Christopher Luna — Software Engineer (v2)",
  robots: { index: false, follow: false },
};

/** v2 preview: the cinematic desk. Unlinked; reachable via the dev switch. */
export default function V2Page() {
  return (
    <main>
      <h1 className="sr-only">Christopher Luna — Software Engineer Portfolio</h1>
      <CinemaScene />
    </main>
  );
}
