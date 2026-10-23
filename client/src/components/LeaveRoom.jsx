import { useEffect, useId, useRef, useState } from "react";
import buttons from "./Button.module.css";
import styles from "./LeaveRoom.module.css";

// Leaving gives up the seat for good, so it asks first. Focus moves into the question and
// back to the button if the person stays, so keyboard users never lose their place.
export default function LeaveRoom({ onLeave, disabled }) {
  const questionId = useId();
  const [confirming, setConfirming] = useState(false);
  const leaveButton = useRef(null);
  const stayButton = useRef(null);
  const wasConfirming = useRef(false);

  useEffect(() => {
    if (confirming) {
      stayButton.current?.focus();
    } else if (wasConfirming.current) {
      leaveButton.current?.focus();
    }
    wasConfirming.current = confirming;
  }, [confirming]);

  if (!confirming) {
    return (
      <button
        ref={leaveButton}
        className={buttons.secondary}
        type="button"
        disabled={disabled}
        onClick={() => setConfirming(true)}
      >
        Leave room
      </button>
    );
  }

  return (
    <div className={styles.confirm} role="group" aria-labelledby={questionId}>
      <p className={styles.question} id={questionId}>
        Leave this room? Your seat and any vote will be removed.
      </p>
      <button className={buttons.danger} type="button" disabled={disabled} onClick={onLeave}>
        Leave
      </button>
      <button
        ref={stayButton}
        className={buttons.secondary}
        type="button"
        onClick={() => setConfirming(false)}
      >
        Stay
      </button>
    </div>
  );
}
