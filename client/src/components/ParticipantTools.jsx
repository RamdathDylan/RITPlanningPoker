import { useEffect, useRef, useState } from "react";
import buttons from "./Button.module.css";
import styles from "./ParticipantList.module.css";

// Facilitator tools for one participant. Removing asks first; focus moves into the question
// and back to the Remove button on cancel.
export default function ParticipantTools({ participant, disabled, onAction }) {
  const [confirming, setConfirming] = useState(false);
  const removeButton = useRef(null);
  const cancelButton = useRef(null);
  const wasConfirming = useRef(false);
  const { id, displayName } = participant;

  useEffect(() => {
    if (confirming) {
      cancelButton.current?.focus();
    } else if (wasConfirming.current) {
      removeButton.current?.focus();
    }
    wasConfirming.current = confirming;
  }, [confirming]);

  if (confirming) {
    return (
      <span className={styles.tools}>
        <span>Remove {displayName} from the room?</span>
        <button
          className={buttons.danger}
          type="button"
          aria-label="Confirm remove"
          disabled={disabled}
          onClick={() => onAction("participant:remove", { participantId: id })}
        >
          Remove
        </button>
        <button
          ref={cancelButton}
          className={buttons.secondary}
          type="button"
          onClick={() => setConfirming(false)}
        >
          Cancel
        </button>
      </span>
    );
  }

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
      <button
        ref={removeButton}
        className={buttons.danger}
        type="button"
        aria-label={`Remove ${displayName}`}
        disabled={disabled}
        onClick={() => setConfirming(true)}
      >
        Remove
      </button>
    </span>
  );
}
