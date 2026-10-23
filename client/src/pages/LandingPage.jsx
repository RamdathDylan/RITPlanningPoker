import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { parseJoinCode } from "../../../shared/join-code.js";
import buttons from "../components/Button.module.css";
import TextField from "../components/TextField.jsx";
import styles from "./Page.module.css";

const INVALID_CODE = "Enter the 8-character room code, like ABCD-EFGH.";

export default function LandingPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);

  function handleJoin(event) {
    event.preventDefault();
    const canonical = parseJoinCode(code);
    if (!canonical) {
      setError(INVALID_CODE);
      return;
    }
    navigate(`/join/${canonical}`);
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Planning Poker</h1>
      <p className={styles.lead}>
        Estimate user stories together in real time. Everyone votes face down, then the facilitator
        reveals the cards.
      </p>

      <section className={styles.section} aria-labelledby="start-heading">
        <h2 className={styles.sectionTitle} id="start-heading">
          Start a session
        </h2>
        <Link className={buttons.primary} to="/new">
          Create a room
        </Link>
      </section>

      <section className={styles.section} aria-labelledby="join-heading">
        <h2 className={styles.sectionTitle} id="join-heading">
          Join a session
        </h2>
        <form className={styles.form} onSubmit={handleJoin} noValidate>
          <TextField
            label="Room code"
            hint="Your facilitator shares this, e.g. ABCD-EFGH."
            name="code"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={code}
            error={error}
            onChange={(event) => {
              setCode(event.target.value);
              setError(null);
            }}
          />
          <button className={buttons.secondary} type="submit">
            Join room
          </button>
        </form>
      </section>
    </main>
  );
}
