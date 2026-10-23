import { useEffect, useId, useRef, useState } from "react";
import buttons from "./Button.module.css";
import styles from "./ConfirmAction.module.css";

// A button for something that can't be undone. It first asks inline; focus moves into the
// question and back to the button if the person cancels, so keyboard users never get lost.
export default function ConfirmAction({
  label,
  ariaLabel,
  question,
  confirmText,
  confirmAriaLabel,
  cancelText,
  onConfirm,
  disabled = false,
}) {
  const questionId = useId();
  const [confirming, setConfirming] = useState(false);
  const trigger = useRef(null);
  const cancel = useRef(null);
  const wasConfirming = useRef(false);

  useEffect(() => {
    if (confirming) {
      cancel.current?.focus();
    } else if (wasConfirming.current) {
      trigger.current?.focus();
    }
    wasConfirming.current = confirming;
  }, [confirming]);

  if (!confirming) {
    return (
      <button
        ref={trigger}
        className={buttons.danger}
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setConfirming(true)}
      >
        {label}
      </button>
    );
  }

  return (
    <span className={styles.confirm} role="group" aria-labelledby={questionId}>
      <span className={styles.question} id={questionId}>
        {question}
      </span>
      <button
        className={buttons.danger}
        type="button"
        aria-label={confirmAriaLabel}
        disabled={disabled}
        onClick={onConfirm}
      >
        {confirmText}
      </button>
      <button
        ref={cancel}
        className={buttons.secondary}
        type="button"
        onClick={() => setConfirming(false)}
      >
        {cancelText}
      </button>
    </span>
  );
}
