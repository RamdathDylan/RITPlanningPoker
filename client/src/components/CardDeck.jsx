import { useId, useRef, useState } from "react";
import styles from "./CardDeck.module.css";
import { CheckIcon } from "./icons.jsx";

const SPECIAL_NAMES = { "?": "Unsure", "☕": "Need a break" };

// What a card shows. The break card's stored value stays "☕" (used by the server and
// database); it is shown as a word, which reads clearly on every screen.
const SPECIAL_FACES = { "☕": "Break" };

export function cardFace(value) {
  return SPECIAL_FACES[value] ?? value;
}

export function cardName(value) {
  return SPECIAL_NAMES[value] ?? `${value} ${value === "1" ? "point" : "points"}`;
}

const MOVES = {
  ArrowRight: (index) => index + 1,
  ArrowDown: (index) => index + 1,
  ArrowLeft: (index) => index - 1,
  ArrowUp: (index) => index - 1,
  Home: () => 0,
  End: (_index, count) => count - 1,
};

// One Tab stop for the whole deck ("roving tabindex": only the focused card has tabIndex 0).
// Arrow keys, Home, and End move focus without voting; Enter or Space votes for the focused
// card; pressing the selected card again clears the vote (docs/architecture.md section 11.4).
export default function CardDeck({ cards, selected, onSelect, disabled = false }) {
  const headingId = useId();
  const buttons = useRef([]);
  const [focusIndex, setFocusIndex] = useState(() => Math.max(0, cards.indexOf(selected)));

  function handleKeyDown(event) {
    const move = MOVES[event.key];
    if (!move) {
      return;
    }
    event.preventDefault();
    const next = (move(focusIndex, cards.length) + cards.length) % cards.length;
    setFocusIndex(next);
    buttons.current[next]?.focus();
  }

  return (
    <section className={styles.deck} aria-labelledby={headingId}>
      <h2 className={styles.heading} id={headingId}>
        Your estimate
      </h2>
      <div
        className={styles.cards}
        role="group"
        aria-labelledby={headingId}
        onKeyDown={handleKeyDown}
      >
        {cards.map((value, index) => {
          const isSelected = value === selected;
          return (
            <button
              key={value}
              ref={(element) => {
                buttons.current[index] = element;
              }}
              type="button"
              className={isSelected ? `${styles.card} ${styles.selected}` : styles.card}
              aria-label={cardName(value)}
              aria-pressed={isSelected}
              tabIndex={index === focusIndex ? 0 : -1}
              disabled={disabled}
              onFocus={() => setFocusIndex(index)}
              onClick={() => onSelect(isSelected ? null : value)}
            >
              <span
                className={
                  value in SPECIAL_FACES ? `${styles.face} ${styles.wordFace}` : styles.face
                }
              >
                {cardFace(value)}
              </span>
              {/* A visible non-color cue; screen readers hear "pressed" via aria-pressed. */}
              {isSelected && (
                <span className={styles.selectedMark}>
                  <CheckIcon />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
