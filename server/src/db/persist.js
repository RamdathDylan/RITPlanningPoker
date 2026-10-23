// Writes one accepted state change to Postgres. Called inside a transaction by RoomService,
// before the new state is committed to memory (ADR-002, ADR-009).

async function insertParticipant(client, { action, next, now }) {
  const { id, displayName, role, tokenHash } = action.participant;
  await client.query(
    `INSERT INTO participants (id, room_id, display_name, role, rejoin_token_hash, joined_at, last_seen)
     VALUES ($1, $2, $3, $4, $5, $6, $6)`,
    [id, next.id, displayName, role, tokenHash, new Date(now)],
  );
}

async function deleteParticipant(client, participantId) {
  await client.query("DELETE FROM participants WHERE id = $1", [participantId]);
}

async function touchParticipant(client, { action, now }) {
  await client.query("UPDATE participants SET last_seen = $1 WHERE id = $2", [
    new Date(now),
    action.participantId,
  ]);
}

// One INSERT for the whole batch: unnest() turns parallel arrays into rows.
async function insertStories(client, { action, next }) {
  const added = next.stories.slice(-action.stories.length);
  await client.query(
    `INSERT INTO stories (id, room_id, title, position)
     SELECT id, $1, title, position
     FROM unnest($2::uuid[], $3::text[], $4::integer[]) AS story(id, title, position)`,
    [
      next.id,
      added.map((story) => story.id),
      added.map((story) => story.title),
      added.map((story) => story.position),
    ],
  );
}

async function insertCurrentRound(client, { next, now }) {
  const { id, storyId, number } = next.round;
  await client.query(
    "INSERT INTO rounds (id, story_id, round_number, started_at) VALUES ($1, $2, $3, $4)",
    [id, storyId, number, new Date(now)],
  );
}

async function deleteVote(client, roundId, participantId) {
  await client.query("DELETE FROM votes WHERE round_id = $1 AND participant_id = $2", [
    roundId,
    participantId,
  ]);
}

async function upsertVote(client, { action, now }) {
  await client.query(
    `INSERT INTO votes (round_id, participant_id, value, cast_at) VALUES ($1, $2, $3, $4)
     ON CONFLICT (round_id, participant_id) DO UPDATE SET value = EXCLUDED.value, cast_at = EXCLUDED.cast_at`,
    [action.roundId, action.actorId, action.value, new Date(now)],
  );
}

async function changeRole(client, { action, previous }) {
  await client.query("UPDATE participants SET role = $1 WHERE id = $2", [
    action.role,
    action.actorId,
  ]);
  if (action.role === "observer" && previous.round) {
    await deleteVote(client, previous.round.id, action.actorId);
  }
}

const childWriters = {
  participantJoined: insertParticipant,
  participantConnected: touchParticipant,
  participantDisconnected: touchParticipant,
  participantLeft: (client, { action }) => deleteParticipant(client, action.actorId),
  participantRemoved: (client, { action }) => deleteParticipant(client, action.participantId),
  roleChanged: changeRole,
  storiesAdded: insertStories,
  storySelected: insertCurrentRound,
  roundRevoted: insertCurrentRound,
  voteCast: upsertVote,
  voteCleared: (client, { action }) => deleteVote(client, action.roundId, action.actorId),
  roundRevealed: (client, { action, now }) =>
    client.query("UPDATE rounds SET revealed_at = $1 WHERE id = $2", [
      new Date(now),
      action.roundId,
    ]),
  estimateAccepted: (client, { action }) =>
    client.query("UPDATE stories SET status = 'estimated', final_estimate = $1 WHERE id = $2", [
      action.value,
      action.storyId,
    ]),
};

// Room-level fields are small, so they are written after every action. That keeps status,
// facilitator, and current story in sync without each action needing its own room update.
async function syncRoomRow(client, { next, now }) {
  await client.query(
    `UPDATE rooms
     SET status = $1, facilitator_id = $2, current_story_id = $3, last_activity_at = $4
     WHERE id = $5`,
    [next.status, next.facilitatorId, next.currentStoryId, new Date(now), next.id],
  );
}

export async function persist(client, change) {
  const writeChildren = childWriters[change.action.type];
  if (writeChildren) {
    await writeChildren(client, change);
  }
  await syncRoomRow(client, change);
}
