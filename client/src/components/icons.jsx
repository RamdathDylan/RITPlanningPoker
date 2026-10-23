// Small decorative icons. They always sit next to text that says the same thing, so they are
// hidden from screen readers (aria-hidden) and never the only signal (WCAG 1.4.1).
const iconProps = {
  "aria-hidden": "true",
  focusable: "false",
  viewBox: "0 0 16 16",
  width: "1em",
  height: "1em",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function CheckIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 8.5l3 3 7-7" />
    </svg>
  );
}

export function WaitingIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 5v3l2 2" />
    </svg>
  );
}
