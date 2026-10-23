import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router";
import { formatJoinCode, parseJoinCode } from "../../../shared/join-code.js";
import Announcer from "../components/Announcer.jsx";
import BacklogPanel from "../components/BacklogPanel.jsx";
import { cardName } from "../components/CardDeck.jsx";
import CurrentRound from "../components/CurrentRound.jsx";
import FacilitatorBar from "../components/FacilitatorBar.jsx";
import LeaveRoom from "../components/LeaveRoom.jsx";
import ParticipantList from "../components/ParticipantList.jsx";
import RoomMessage from "../components/RoomMessage.jsx";
import SessionSummary from "../components/SessionSummary.jsx";
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

// "Votes revealed. Average 5.5, median 5.5, range 3 to 8." once per revealed round.
function useRevealAnnouncement(room, announce) {
  const revealedRoundId = room?.round?.revealed ? room.round.id : null;
  const stats = room?.round?.stats;
  useEffect(() => {
    if (!revealedRoundId) {
      return;
    }
    const summary =
      stats.numericCount === 0
        ? "No numeric votes."
        : `Average ${stats.mean}, median ${stats.median}, range ${stats.min} to ${stats.max}.`;
    announce(`Votes revealed. ${summary}`);
    // The reducer keeps the same round object until the round changes, so this runs once
    // per reveal even though other room updates keep arriving.
  }, [revealedRoundId, stats, announce]);
}

export default function RoomPage() {
  const params = useParams();
  const code = parseJoinCode(params.code);
  const { status, room, error, removedReason, send, leave } = useRoom(code ?? "");
  const [announcement, setAnnouncement] = useState("");
  const [actionError, setActionError] = useState(null);
  useVotingProgress(room, setAnnouncement);
  useRevealAnnouncement(room, setAnnouncement);

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

  // Sends an action and shows the server's reason if it is refused.
  async function runAction(event, payload) {
    const ack = await send(event, payload);
    setActionError(ack.ok ? null : ack.error.message);
    return ack.ok;
  }

  async function handleLeave() {
    const ack = await leave();
    if (!ack.ok) {
      setActionError(ack.error.message);
    }
  }

  async function handleVote(value) {
    const roundId = room.round.id;
    const accepted =
      value === null
        ? await runAction("vote:clear", { roundId })
        : await runAction("vote:cast", { roundId, value });
    if (accepted) {
      setAnnouncement(value === null ? "Vote cleared" : `You voted ${spokenCard(value)}`);
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
        <LeaveRoom onLeave={handleLeave} disabled={reconnecting} />
      </header>
      {actionError && (
        <p className={styles.actionError} role="alert">
          {actionError}
        </p>
      )}
      <div className={styles.layout}>
        <div className={styles.primary}>
          {room.room.status !== "ended" && (
            <CurrentRound
              room={room}
              disabled={reconnecting}
              onVote={handleVote}
              onAction={runAction}
            />
          )}
          {room.me.isFacilitator && room.room.status !== "ended" && (
            <FacilitatorBar room={room} disabled={reconnecting} onAction={runAction} />
          )}
          {room.room.status === "ended" && <SessionSummary stories={room.stories} />}
        </div>
        <div className={styles.secondary}>
          <ParticipantList
            participants={room.participants}
            facilitatorId={room.room.facilitatorId}
            meId={room.me.participantId}
            roundOpen={room.round !== null}
            canManage={room.me.isFacilitator && room.room.status !== "ended"}
            disabled={reconnecting}
            onAction={runAction}
          />
          {room.room.status !== "ended" && (
            <BacklogPanel room={room} disabled={reconnecting} onAction={runAction} />
          )}
        </div>
      </div>
      <Announcer message={announcement} />
    </main>
  );
}
