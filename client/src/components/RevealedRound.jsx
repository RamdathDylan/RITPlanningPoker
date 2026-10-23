import { useId, useState } from "react";
import { NUMERIC_CARDS } from "../../../shared/events.js";
import buttons from "./Button.module.css";
import styles from "./RevealedRound.module.css";

export function describeStats(stats) {
  if (stats.numericCount === 0) {
    return "No numeric votes.";
  }
  return `Average ${stats.mean} · Median ${stats.median} · Range ${stats.min} to ${stats.max}`;
}

function extraCounts(stats) {
  return [
    stats.unsureCount > 0 && `${stats.unsureCount} unsure`,
    stats.breakCount > 0 && `${stats.breakCount} need a break`,
  ]
    .filter(Boolean)
    .join(", ");
}

function AcceptEstimate({ storyId, suggestion, disabled, onAction }) {
  const id = useId();
  const [value, setValue] = useState(suggestion ?? "");
  return (
    <form
      className={styles.accept}
      onSubmit={(event) => {
        event.preventDefault();
        onAction("estimate:accept", { storyId, value });
      }}
    >
      <label className={styles.label} htmlFor={id}>
        Final estimate
      </label>
      <select
        className={styles.select}
        id={id}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      >
        <option value="" disabled>
          Choose…
        </option>
        {NUMERIC_CARDS.map((card) => (
          <option key={card} value={card}>
            {card}
          </option>
        ))}
      </select>
      <button className={buttons.primary} type="submit" disabled={disabled || value === ""}>
        Accept estimate
      </button>
    </form>
  );
}

export default function RevealedRound({ room, disabled, onAction }) {
  const { votes, stats } = room.round;
  const nameOf = (id) =>
    room.participants.find((participant) => participant.id === id)?.displayName ?? "Someone";
  const extras = extraCounts(stats);

  return (
    <div className={styles.revealed}>
      <ul className={styles.votes} aria-label="Votes">
        {votes.map((vote) => (
          <li className={styles.vote} key={vote.participantId}>
            <span className={styles.voter}>{nameOf(vote.participantId)}</span>
            <span className={styles.card}>{vote.value}</span>
          </li>
        ))}
      </ul>
      <p className={styles.stats}>{describeStats(stats)}</p>
      {stats.numericCount > 0 && <p>{stats.consensus ? "Everyone agreed." : "Votes differ."}</p>}
      {extras && <p>{extras}</p>}
      {room.me.isFacilitator && (
        <AcceptEstimate
          key={room.round.id}
          storyId={room.room.currentStoryId}
          suggestion={stats.suggestion}
          disabled={disabled}
          onAction={onAction}
        />
      )}
    </div>
  );
}
