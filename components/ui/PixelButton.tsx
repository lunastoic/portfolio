"use client";

import "./ui.css";

interface PixelButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  download?: boolean;
  variant?: "solid" | "outline";
  ariaLabel?: string;
}

/** Chunky terminal-style button. Renders an <a> when href is given. */
export default function PixelButton({
  children,
  onClick,
  href,
  download,
  variant = "outline",
  ariaLabel,
}: PixelButtonProps) {
  const className = `pixel-btn pixel-btn--${variant}`;

  if (href) {
    const isPlaceholder = href === "#";
    return (
      <a
        className={className}
        href={href}
        download={download}
        aria-label={ariaLabel}
        aria-disabled={isPlaceholder || undefined}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
        onClick={isPlaceholder ? (e) => e.preventDefault() : undefined}
      >
        {children}
      </a>
    );
  }

  return (
    <button type="button" className={className} onClick={onClick} aria-label={ariaLabel}>
      {children}
    </button>
  );
}
