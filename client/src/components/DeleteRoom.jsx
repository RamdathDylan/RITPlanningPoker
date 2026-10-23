import { useEffect, useRef, useState } from "react";
import { parseJoinCode } from "../../../shared/join-code.js";
import buttons from "./Button.module.css";
import styles from "./DeleteRoom.module.css";
import TextField from "./TextField.jsx";

// Deleting is permanent for everyone, so the facilitator must type the room code first.
export default function DeleteRoom({ code, onDelete, disabled }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const trigger = useRef(null);
  const wasOpen = useRef(false);
  const matches = parseJoinCode(typed) === code;

  useEffect(() => {
    if (!open && wasOpen.current) {
      trigger.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  if (!open) {
    return (
      <button
        ref={trigger}
        className={buttons.danger}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        Delete room
      </button>
    );
  }

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        onDelete(code);
      }}
    >
      <p className={styles.warning}>
        This permanently deletes the room, its stories, and its votes for everyone. Type the room
        code to confirm.
      </p>
      <TextField
        label="Room code to confirm"
        name="confirmCode"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        autoFocus
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
      />
      <div className={styles.actions}>
        <button className={buttons.danger} type="submit" disabled={disabled || !matches}>
          Delete permanently
        </button>
        <button
          className={buttons.secondary}
          type="button"
          onClick={() => {
            setTyped("");
            setOpen(false);
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
