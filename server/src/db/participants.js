export async function findParticipantByTokenHash(db, tokenHash) {
  const { rows } = await db.query(
    `SELECT id, room_id AS "roomId", display_name AS "displayName", role
     FROM participants WHERE rejoin_token_hash = $1`,
    [tokenHash],
  );
  return rows[0] ?? null;
}
