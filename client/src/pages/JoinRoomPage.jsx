import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { LIMITS } from "../../../shared/events.js";
import { formatJoinCode, parseJoinCode } from "../../../shared/join-code.js";
import buttons from "../components/Button.module.css";
import TextField from "../components/TextField.jsx";
import { checkText } from "../forms.js";
import { useServices } from "../services.jsx";
import styles from "./Page.module.css";

const INVALID_CODE = "Enter the 8-character room code, like ABCD-EFGH.";

function initialCode(fromLink) {
  const canonical = parseJoinCode(fromLink);
  return canonical ? formatJoinCode(canonical) : (fromLink ?? "");
}

export default function JoinRoomPage() {
  const { api, sessions } = useServices();
  const navigate = useNavigate();
  const params = useParams();
  const [code, setCode] = useState(() => initialCode(params.code));
  const [displayName, setDisplayName] = useState("");
  const [observer, setObserver] = useState(false);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const canonicalCode = parseJoinCode(code);
  const existingSeat = canonicalCode ? sessions.load(canonicalCode) : null;

  async function handleSubmit(event) {
    event.preventDefault();
    const name = checkText(displayName, { max: LIMITS.displayNameMax });
    if (!canonicalCode || name.error) {
      setErrors({ code: canonicalCode ? null : INVALID_CODE, displayName: name.error });
      return;
    }

    setSubmitting(true);
    setServerError(null);
    try {
      const role = observer ? "observer" : "voter";
      const seat = await api.joinRoom(canonicalCode, { displayName: name.value, role });
      sessions.save(canonicalCode, { participantId: seat.participantId, token: seat.rejoinToken });
      navigate(`/room/${canonicalCode}`);
    } catch (error) {
      if (error.code === "NAME_TAKEN") {
        setErrors({ displayName: error.message });
      } else {
        setServerError(error.message);
      }
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Join a room</h1>
      {existingSeat && (
        <p className={styles.notice}>
          You already have a seat in this room.{" "}
          <Link to={`/room/${canonicalCode}`}>Return to the room</Link>
        </p>
      )}
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <TextField
          label="Room code"
          name="code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={code}
          error={errors.code}
          onChange={(event) => {
            setCode(event.target.value);
            setErrors((current) => ({ ...current, code: null }));
          }}
        />
        <TextField
          label="Your name"
          hint={`First name or nickname, up to ${LIMITS.displayNameMax} characters. Everyone in the room sees it.`}
          name="displayName"
          autoComplete="nickname"
          value={displayName}
          error={errors.displayName}
          onChange={(event) => {
            setDisplayName(event.target.value);
            setErrors((current) => ({ ...current, displayName: null }));
          }}
        />
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={observer}
            onChange={(event) => setObserver(event.target.checked)}
          />
          Join as an observer (watch without voting)
        </label>
        {serverError && (
          <p className={styles.alert} role="alert">
            {serverError}
          </p>
        )}
        <div className={styles.actions}>
          <button className={buttons.primary} type="submit" disabled={submitting}>
            {submitting ? "Joining room…" : "Join room"}
          </button>
          <Link to="/">Back</Link>
        </div>
      </form>
    </main>
  );
}
