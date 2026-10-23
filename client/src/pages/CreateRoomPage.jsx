import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { LIMITS } from "../../../shared/events.js";
import buttons from "../components/Button.module.css";
import TextField from "../components/TextField.jsx";
import { checkText } from "../forms.js";
import { useServices } from "../services.jsx";
import styles from "./Page.module.css";

export default function CreateRoomPage() {
  const { api, sessions } = useServices();
  const navigate = useNavigate();
  const [fields, setFields] = useState({ roomName: "", displayName: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (name) => (event) => {
    setFields((current) => ({ ...current, [name]: event.target.value }));
    setErrors((current) => ({ ...current, [name]: null }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    const roomName = checkText(fields.roomName, { max: LIMITS.roomNameMax });
    const displayName = checkText(fields.displayName, { max: LIMITS.displayNameMax });
    if (roomName.error || displayName.error) {
      setErrors({ roomName: roomName.error, displayName: displayName.error });
      return;
    }

    setSubmitting(true);
    setServerError(null);
    try {
      const room = await api.createRoom({
        roomName: roomName.value,
        displayName: displayName.value,
      });
      sessions.save(room.code, { participantId: room.participantId, token: room.rejoinToken });
      navigate(`/room/${room.code}`);
    } catch (error) {
      setServerError(error.message);
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Create a room</h1>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <TextField
          label="Room name"
          hint={`Up to ${LIMITS.roomNameMax} characters.`}
          name="roomName"
          autoComplete="off"
          value={fields.roomName}
          error={errors.roomName}
          onChange={update("roomName")}
        />
        <TextField
          label="Your name"
          hint={`First name or nickname, up to ${LIMITS.displayNameMax} characters. Everyone in the room sees it.`}
          name="displayName"
          autoComplete="nickname"
          value={fields.displayName}
          error={errors.displayName}
          onChange={update("displayName")}
        />
        {serverError && (
          <p className={styles.alert} role="alert">
            {serverError}
          </p>
        )}
        <div className={styles.actions}>
          <button className={buttons.primary} type="submit" disabled={submitting}>
            {submitting ? "Creating room…" : "Create room"}
          </button>
          <Link to="/">Back</Link>
        </div>
      </form>
    </main>
  );
}
