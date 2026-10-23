// Writes one accepted state change to Postgres. Called inside a transaction by RoomService,
// before the new state is committed to memory (ADR-002, ADR-009).

async function insertParticipant(client, { action, next }) {
  const { id, displayName, role, tokenHash } = action.participant;
  await client.query(
    `INSERT INTO participants (id, room_id, display_name, role, rejoin_token_hash)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, next.id, displayName, role, tokenHash],
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

const childWriters = {
  participantJoined: insertParticipant,
  participantConnected: touchParticipant,
  participantDisconnected: touchParticipant,
  participantLeft: (client, { action }) => deleteParticipant(client, action.actorId),
  participantRemoved: (client, { action }) => deleteParticipant(client, action.participantId),
  roleChanged: (client, { action }) =>
    client.query("UPDATE participants SET role = $1 WHERE id = $2", [action.role, action.actorId]),
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
