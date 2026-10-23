import { useId } from "react";
import styles from "./TextField.module.css";

// A labelled input whose hint and error are tied to it with aria-describedby, so screen
// readers announce them, and whose invalid state is exposed with aria-invalid.
export default function TextField({ label, hint, error, ...inputProps }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      {hint && (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      )}
      <input
        className={styles.input}
        id={id}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={describedBy}
        {...inputProps}
      />
      {error && (
        <p className={styles.error} id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}
