import buttons from "./Button.module.css";
import ConfirmAction from "./ConfirmAction.jsx";
import styles from "./ParticipantList.module.css";

// Facilitator tools for one participant.
export default function ParticipantTools({ participant, disabled, onAction }) {
  const { id, displayName } = participant;
  return (
    <span className={styles.tools}>
      <button
        className={buttons.secondary}
        type="button"
        aria-label={`Make facilitator: ${displayName}`}
        disabled={disabled}
        onClick={() => onAction("facilitator:transfer", { participantId: id })}
      >
        Make facilitator
      </button>
      <ConfirmAction
        label="Remove"
        ariaLabel={`Remove ${displayName}`}
        question={`Remove ${displayName} from the room?`}
        confirmText="Remove"
        confirmAriaLabel="Confirm remove"
        cancelText="Cancel"
        onConfirm={() => onAction("participant:remove", { participantId: id })}
        disabled={disabled}
      />
    </span>
  );
}
