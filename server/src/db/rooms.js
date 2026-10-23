import { withTransaction } from "./transaction.js";

// Ids come from the app (crypto.randomUUID) so memory and database agree without a round trip.
// The facilitator foreign key is deferred, so both rows can be inserted in one transaction.
export function insertRoomWithFacilitator(pool, { roomId, code, name, facilitator }) {
  return withTransaction(pool, async (client) => {
    await client.query(
      "INSERT INTO rooms (id, join_code, name, facilitator_id) VALUES ($1, $2, $3, $4)",
      [roomId, code, name, facilitator.id],
    );
    await client.query(
      `INSERT INTO participants (id, room_id, display_name, role, rejoin_token_hash)
       VALUES ($1, $2, $3, 'voter', $4)`,
      [facilitator.id, roomId, facilitator.displayName, facilitator.tokenHash],
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
