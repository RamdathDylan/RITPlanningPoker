// A polite live region: screen readers read changes to it without moving focus.
export default function Announcer({ message }) {
  return (
    <p className="visually-hidden" role="status" aria-live="polite" data-testid="announcer">
      {message}
    </p>
  );
}
