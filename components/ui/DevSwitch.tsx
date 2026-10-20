"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "./dev-switch.css";

const VERSIONS = [
  { href: "/", label: "V1" },
  { href: "/v2", label: "V2" },
];

/** Development-only toggle between the scene versions. Rendered by the root layout in dev builds. */
export default function DevSwitch() {
  const path = usePathname();
  return (
    <nav className="dev-switch" aria-label="Scene version (development only)">
      {VERSIONS.map((v) => (
        <Link key={v.href} href={v.href} aria-current={path === v.href ? "page" : undefined}>
          {v.label}
        </Link>
      ))}
    </nav>
  );
}
