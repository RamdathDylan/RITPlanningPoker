// Rebuilds a room's in-memory state from Postgres (after a restart, or when a room is first
// used). Everyone starts disconnected; their sockets reconnect and mark them connected again.

const toMillis = (date) => (date === null ? null : date.getTime());

async function loadParticipants(db, roomId) {
  const { rows } = await db.query(
    `SELECT id, display_name, role, joined_at FROM participants
     WHERE room_id = $1 ORDER BY joined_at, id`,
    [roomId],
  );
  return rows.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    role: row.role,
    joinedAt: toMillis(row.joined_at),
    connected: false,
    connectedAt: null,
    disconnectedAt: null,
  }));
}

async function loadStories(db, roomId) {
  const { rows } = await db.query(
    `SELECT s.id, s.title, s.position, s.status, s.final_estimate,
            COALESCE(max(r.round_number), 0)::integer AS round_count
     FROM stories s LEFT JOIN rounds r ON r.story_id = s.id
     WHERE s.room_id = $1
     GROUP BY s.id
     ORDER BY s.position`,
    [roomId],
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    position: row.position,
    status: row.status,
    finalEstimate: row.final_estimate,
    roundCount: row.round_count,
  }));
}

// Only the latest round of the current story matters; older and abandoned rounds are history.
async function loadCurrentRound(db, storyId) {
  const { rows } = await db.query(
    `SELECT id, round_number, revealed_at FROM rounds
     WHERE story_id = $1 ORDER BY round_number DESC LIMIT 1`,
    [storyId],
  );
  const round = rows[0];
  const { rows: votes } = await db.query(
    "SELECT participant_id, value FROM votes WHERE round_id = $1",
    [round.id],
  );
  return {
    id: round.id,
    storyId,
    number: round.round_number,
    votes: Object.fromEntries(votes.map((vote) => [vote.participant_id, vote.value])),
    revealedAt: toMillis(round.revealed_at),
  };
}

export async function loadRoomState(db, roomId) {
  const { rows } = await db.query(
    `SELECT id, join_code, name, status, facilitator_id, current_story_id
     FROM rooms WHERE id = $1`,
    [roomId],
  );
  const room = rows[0];
  if (!room) {
    return null;
  }
  const hasOpenRound = room.status === "voting" || room.status === "revealed";
  return {
    id: room.id,
    code: room.join_code,
    name: room.name,
    status: room.status,
    facilitatorId: room.facilitator_id,
    participants: await loadParticipants(db, roomId),
    stories: await loadStories(db, roomId),
    currentStoryId: room.current_story_id,
    round: hasOpenRound ? await loadCurrentRound(db, room.current_story_id) : null,
  };
}
