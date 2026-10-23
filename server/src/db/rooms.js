import { withTransaction } from "./transaction.js";

// Ids come from the app (crypto.randomUUID) so memory and database agree without a round trip.
// The facilitator foreign key is deferred, so both rows can be inserted in one transaction.
// Timestamps use the same `now` as the in-memory state, so a reload matches exactly.
export function insertRoomWithFacilitator(pool, { roomId, code, name, facilitator, now }) {
  const at = new Date(now);
  return withTransaction(pool, async (client) => {
    await client.query(
      `INSERT INTO rooms (id, join_code, name, facilitator_id, created_at, last_activity_at)
       VALUES ($1, $2, $3, $4, $5, $5)`,
      [roomId, code, name, facilitator.id, at],
    );
    await client.query(
      `INSERT INTO participants (id, room_id, display_name, role, rejoin_token_hash, joined_at, last_seen)
       VALUES ($1, $2, $3, 'voter', $4, $5, $5)`,
      [facilitator.id, roomId, facilitator.displayName, facilitator.tokenHash, at],
    );
  });
}

export async function findRoomByCode(db, code) {
  const { rows } = await db.query(
    `SELECT id, join_code AS code, name, status, facilitator_id AS "facilitatorId"
     FROM rooms WHERE join_code = $1`,
    [code],
  );
  return rows[0] ?? null;
}

// "Live" means not ended and used within the last day; the cap protects the server's memory.
export async function countLiveRooms(db) {
  const { rows } = await db.query(
    `SELECT count(*)::integer AS count FROM rooms
     WHERE status <> 'ended' AND last_activity_at > now() - interval '1 day'`,
  );
  return rows[0].count;
}

// Deleting the room row deletes everything it owns (ON DELETE CASCADE).
export async function deleteRoom(db, roomId) {
  await db.query("DELETE FROM rooms WHERE id = $1", [roomId]);
}

// Deletes every room not used since `cutoff` (cascading to everything it owns) and returns
// their ids so live copies can be evicted from memory.
export async function deleteRoomsInactiveSince(db, cutoff) {
  const { rows } = await db.query("DELETE FROM rooms WHERE last_activity_at < $1 RETURNING id", [
    cutoff,
  ]);
  return rows.map((row) => row.id);
}
