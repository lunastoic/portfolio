import "./ui.css";

/**
 * Terminal-style hover/focus tooltip label for desk objects.
 * Rendered inside a positioned parent with the `has-tooltip` class;
 * shown via CSS on :hover / :focus-visible of the parent.
 */
export default function Tooltip({ label }: { label: string }) {
  return (
    <span className="desk-tooltip" aria-hidden="true">
      {label}
    </span>
  );
}
