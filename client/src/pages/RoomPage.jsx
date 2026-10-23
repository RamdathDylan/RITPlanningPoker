import { Navigate, useParams } from "react-router";
import { formatJoinCode, parseJoinCode } from "../../../shared/join-code.js";
import ParticipantList from "../components/ParticipantList.jsx";
import RoomMessage from "../components/RoomMessage.jsx";
import { useRoom } from "../socket/useRoom.js";
import styles from "./RoomPage.module.css";

const HOME = { linkTo: "/", linkText: "Go to the home page" };

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
  const { status, room, error, removedReason } = useRoom(code ?? "");

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

  return (
    <main className={styles.room} aria-busy={reconnecting}>
      {banner}
      <header className={styles.header}>
        <h1 className={styles.name}>{room.room.name}</h1>
        <p className={styles.code}>
          Room code <strong>{formatJoinCode(room.room.code)}</strong>
        </p>
      </header>
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
    </main>
  );
}
