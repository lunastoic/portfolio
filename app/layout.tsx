import type { Metadata } from "next";
import { VT323 } from "next/font/google";
import DevSwitch from "@/components/ui/DevSwitch";
import "./globals.css";

const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-vt323",
});

export const metadata: Metadata = {
  title: "Christopher Luna — Software Engineer",
  description:
    "Interactive retro terminal portfolio of Christopher Luna, software engineer. B.S. Computer Science, CSU Dominguez Hills.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={vt323.variable}>
      <body>
        {children}
        <div className="crt-overlay" aria-hidden="true" />
        <div className="crt-flicker" aria-hidden="true" />
        {process.env.NODE_ENV === "development" && <DevSwitch />}
      </body>
    </html>
  );
}
