import { CheckIcon, WaitingIcon } from "./icons.jsx";
import styles from "./ParticipantList.module.css";

function VoteStatus({ hasVoted }) {
  return hasVoted ? (
    <span className={styles.voted}>
      <CheckIcon /> Voted
    </span>
  ) : (
    <span className={styles.waiting}>
      <WaitingIcon /> Waiting
    </span>
  );
}

export default function ParticipantList({ participants, facilitatorId, meId, roundOpen }) {
  return (
    <section className={styles.panel} aria-labelledby="participants-heading">
      <h2 className={styles.heading} id="participants-heading">
        Participants ({participants.length})
      </h2>
      <ul className={styles.list}>
        {participants.map((participant) => (
          <li className={styles.row} key={participant.id}>
            <span className={styles.name}>
              {participant.displayName}
              {participant.id === meId && <span className={styles.tag}> (you)</span>}
            </span>
            <span className={styles.badges}>
              {participant.id === facilitatorId && (
                <span className={styles.badge}>Facilitator</span>
              )}
              {participant.role === "observer" && <span className={styles.badge}>Observer</span>}
              {!participant.connected && <span className={styles.badge}>Offline</span>}
              {roundOpen && participant.role === "voter" && (
                <VoteStatus hasVoted={participant.hasVoted} />
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
