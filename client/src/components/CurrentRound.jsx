import { FIBONACCI_DECK } from "../../../shared/events.js";
import CardDeck from "./CardDeck.jsx";
import RevealedRound from "./RevealedRound.jsx";
import styles from "./CurrentRound.module.css";

export default function CurrentRound({ room, disabled, onVote, onAction }) {
  const story = room.stories.find((candidate) => candidate.id === room.room.currentStoryId);

  if (!story || !room.round) {
    return <p className={styles.waiting}>Waiting for the facilitator to pick a story.</p>;
  }

  const voting = room.room.status === "voting";
  return (
    <section className={styles.round} aria-labelledby="current-story-heading">
      <p className={styles.eyebrow}>Current story · Round {room.round.number}</p>
      <h2 className={styles.title} id="current-story-heading">
        {story.title}
      </h2>
      {voting && room.me.role === "voter" && (
        <CardDeck
          cards={FIBONACCI_DECK}
          selected={room.me.myVote}
          onSelect={onVote}
          disabled={disabled}
        />
      )}
      {voting && room.me.role === "observer" && (
        <p className={styles.waiting}>You&apos;re observing this round.</p>
      )}
      {room.round.revealed && <RevealedRound room={room} disabled={disabled} onAction={onAction} />}
    </section>
  );
}
