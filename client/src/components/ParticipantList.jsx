import buttons from "./Button.module.css";
import { CheckIcon, WaitingIcon } from "./icons.jsx";
import ParticipantTools from "./ParticipantTools.jsx";
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

export default function ParticipantList({
  participants,
  facilitatorId,
  meId,
  roundOpen,
  canManage = false,
  disabled = false,
  onAction = () => {},
}) {
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
            {participant.id === meId && (
              <button
                className={buttons.secondary}
                type="button"
                disabled={disabled}
                onClick={() =>
                  onAction("participant:setRole", {
                    role: participant.role === "voter" ? "observer" : "voter",
                  })
                }
              >
                {participant.role === "voter" ? "Switch to observer" : "Switch to voter"}
              </button>
            )}
            {canManage && participant.id !== meId && (
              <ParticipantTools participant={participant} disabled={disabled} onAction={onAction} />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
