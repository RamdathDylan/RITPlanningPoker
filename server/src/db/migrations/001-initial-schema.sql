-- Initial schema. See docs/architecture.md section 7.
-- Every size cap in CLAUDE.md is repeated here as a CHECK constraint, as a second line of
-- defense behind the app's validators. Deleting a room deletes everything it owns.

CREATE TABLE rooms (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  join_code        char(8) NOT NULL UNIQUE CHECK (join_code ~ '^[2-9A-HJKMNP-Z]{8}$'),
  name             text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  deck_type        text NOT NULL DEFAULT 'fibonacci' CHECK (deck_type IN ('fibonacci')),
  facilitator_id   uuid,
  status           text NOT NULL DEFAULT 'idle'
                   CHECK (status IN ('idle', 'voting', 'revealed', 'ended')),
  current_story_id uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX rooms_last_activity_idx ON rooms (last_activity_at);

CREATE TABLE participants (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id           uuid NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
  display_name      text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 40),
  role              text NOT NULL CHECK (role IN ('voter', 'observer')),
  rejoin_token_hash bytea NOT NULL UNIQUE CHECK (octet_length(rejoin_token_hash) = 32),
  joined_at         timestamptz NOT NULL DEFAULT now(),
  last_seen         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX participants_room_name_uq ON participants (room_id, lower(display_name));

-- rooms and participants point at each other, so this key is checked at COMMIT
-- (DEFERRABLE INITIALLY DEFERRED), letting a room and its facilitator be created together.
ALTER TABLE rooms
  ADD CONSTRAINT rooms_facilitator_fk FOREIGN KEY (facilitator_id)
  REFERENCES participants (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE stories (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id        uuid NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
  title          text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  position       integer NOT NULL CHECK (position >= 0),
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'estimated')),
  final_estimate text CHECK (final_estimate IN ('0', '1', '2', '3', '5', '8', '13', '21')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, position),
  CHECK ((status = 'estimated') = (final_estimate IS NOT NULL))
);

ALTER TABLE rooms
  ADD CONSTRAINT rooms_current_story_fk FOREIGN KEY (current_story_id)
  REFERENCES stories (id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE rounds (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id     uuid NOT NULL REFERENCES stories (id) ON DELETE CASCADE,
  round_number integer NOT NULL CHECK (round_number >= 1),
  started_at   timestamptz NOT NULL DEFAULT now(),
  revealed_at  timestamptz,
  UNIQUE (story_id, round_number)
);

CREATE TABLE votes (
  round_id       uuid NOT NULL REFERENCES rounds (id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES participants (id) ON DELETE CASCADE,
  value          text NOT NULL CHECK (value IN ('0', '1', '2', '3', '5', '8', '13', '21', '?', '☕')),
  cast_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (round_id, participant_id)
);
CREATE INDEX votes_participant_idx ON votes (participant_id);
