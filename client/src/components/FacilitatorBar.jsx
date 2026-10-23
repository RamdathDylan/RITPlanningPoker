import buttons from "./Button.module.css";
import styles from "./FacilitatorBar.module.css";

function nextPendingStory(stories) {
  return [...stories]
    .filter((story) => story.status === "pending")
    .sort((a, b) => a.position - b.position)[0];
}

// Shown only to the facilitator. The server still checks every action; hiding the bar from
// others is only for clarity.
export default function FacilitatorBar({ room, disabled, onAction }) {
  const { status } = room.room;
  const anyVotes = room.participants.some((participant) => participant.hasVoted);
  const next = status === "idle" ? nextPendingStory(room.stories) : undefined;

  return (
    <section className={styles.bar} aria-label="Facilitator controls">
      {status === "voting" && (
        <button
          className={buttons.primary}
          type="button"
          disabled={disabled || !anyVotes}
          onClick={() => onAction("round:reveal", { roundId: room.round.id })}
        >
          Reveal votes
        </button>
      )}
      {status === "revealed" && (
        <button
          className={buttons.secondary}
          type="button"
          disabled={disabled}
          onClick={() => onAction("round:revote", { roundId: room.round.id })}
        >
          Vote again
        </button>
      )}
      {next && (
        <button
          className={buttons.primary}
          type="button"
          disabled={disabled}
          onClick={() => onAction("story:select", { storyId: next.id })}
        >
          Next story
        </button>
      )}
    </section>
  );
}
