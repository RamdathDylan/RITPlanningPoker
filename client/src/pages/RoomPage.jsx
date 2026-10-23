import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router";
import { formatJoinCode, parseJoinCode } from "../../../shared/join-code.js";
import Announcer from "../components/Announcer.jsx";
import { cardName } from "../components/CardDeck.jsx";
import CurrentRound from "../components/CurrentRound.jsx";
import ParticipantList from "../components/ParticipantList.jsx";
import RoomMessage from "../components/RoomMessage.jsx";
import { useRoom } from "../socket/useRoom.js";
import styles from "./RoomPage.module.css";

const HOME = { linkTo: "/", linkText: "Go to the home page" };
const PROGRESS_DELAY_MS = 1000;

const spokenCard = (value) => (/^\d+$/.test(value) ? value : cardName(value));

// "3 of 5 voters have voted", announced after a short pause so rapid changes don't chatter.
function useVotingProgress(room, announce) {
  const voting = room?.room.status === "voting";
  const voters = room?.participants.filter((participant) => participant.role === "voter") ?? [];
  const voterCount = voters.length;
  const votedCount = voters.filter((participant) => participant.hasVoted).length;

  useEffect(() => {
    if (!voting) {
      return undefined;
    }
    const timer = setTimeout(
      () => announce(`${votedCount} of ${voterCount} voters have voted`),
      PROGRESS_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [voting, votedCount, voterCount, announce]);
}

function terminalMessage({ status, removedReason, error, code }) {
  switch (status) {
    case "unauthorized":
      return {
        title: "Your seat isn't valid anymore",
        body: "This browser's seat in the room no longer exists. You can join again with a name.",
        linkTo: `/join/${code}`,
        linkText: "Join again",
      };
    case "removed":
      return removedReason === "deleted"
        ? {
            title: "This room was deleted",
            body: "The facilitator deleted this room and its data.",
            ...HOME,
          }
        : { title: "You were removed from this room", body: null, ...HOME };
    case "left":
      return { title: "You left the room", body: null, ...HOME };
    case "failed":
      return { title: "Couldn't open this room", body: error?.message, ...HOME };
    default:
      return null;
  }
}

export default function RoomPage() {
  const params = useParams();
  const code = parseJoinCode(params.code);
  const { status, room, error, removedReason, send } = useRoom(code ?? "");
  const [announcement, setAnnouncement] = useState("");
  const [actionError, setActionError] = useState(null);
  useVotingProgress(room, setAnnouncement);

  if (status === "no-seat") {
    return <Navigate replace to={`/join/${code ?? ""}`} />;
  }
  const message = terminalMessage({ status, removedReason, error, code });
  if (message) {
    return (
      <RoomMessage title={message.title} linkTo={message.linkTo} linkText={message.linkText}>
        {message.body}
      </RoomMessage>
    );
  }

  const reconnecting = status === "reconnecting";
  const banner = reconnecting && (
    <p className={styles.banner} role="alert">
      Connection lost. Reconnecting…
    </p>
  );

  if (!room) {
    return (
      <main className={styles.room}>
        {banner}
        <p role="status">Joining the room…</p>
      </main>
    );
  }

  async function handleVote(value) {
    const roundId = room.round.id;
    const ack =
      value === null
        ? await send("vote:clear", { roundId })
        : await send("vote:cast", { roundId, value });
    if (ack.ok) {
      setActionError(null);
      setAnnouncement(value === null ? "Vote cleared" : `You voted ${spokenCard(value)}`);
    } else {
      setActionError(ack.error.message);
    }
  }

  return (
    <main className={styles.room} aria-busy={reconnecting}>
      {banner}
      <header className={styles.header}>
        <h1 className={styles.name}>{room.room.name}</h1>
        <p className={styles.code}>
          Room code <strong>{formatJoinCode(room.room.code)}</strong>
        </p>
      </header>
      {actionError && (
        <p className={styles.actionError} role="alert">
          {actionError}
        </p>
      )}
      {room.room.status !== "ended" && (
        <CurrentRound room={room} disabled={reconnecting} onVote={handleVote} />
      )}
      <ParticipantList
        participants={room.participants}
        facilitatorId={room.room.facilitatorId}
        meId={room.me.participantId}
        roundOpen={room.round !== null}
      />
      {room.room.status === "ended" && (
        <section aria-labelledby="ended-heading">
          <h2 id="ended-heading">This session has ended</h2>
        </section>
      )}
      <Announcer message={announcement} />
    </main>
  );
}
