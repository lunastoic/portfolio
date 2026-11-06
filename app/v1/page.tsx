import type { Metadata } from "next";
import IntroGate from "@/components/intro/IntroGate";

export const metadata: Metadata = {
  title: "Christopher Luna — Software Engineer (v1)",
  robots: { index: false, follow: false },
};

/** v1: the original retro terminal, kept at /v1. */
export default function V1Page() {
  return (
    <main>
      <h1 className="sr-only">
        Christopher Luna — Software Engineer Portfolio
      </h1>
      <IntroGate />
    </main>
  );
}
