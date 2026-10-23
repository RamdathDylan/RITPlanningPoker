import {
  participantConnected,
  participantDisconnected,
  participantJoined,
  participantLeft,
  participantRemoved,
  roleChanged,
} from "./participants.js";
import { reject } from "./results.js";
import { storiesAdded } from "./stories.js";

const handlers = {
  participantJoined,
  participantLeft,
  participantConnected,
  participantDisconnected,
  roleChanged,
  participantRemoved,
  storiesAdded,
};

// The room state machine: reduce(state, action, now) -> { ok, state, effects } | { ok, code }.
// Pure: no I/O, no clock, no randomness. Ids and `now` arrive in the action and argument.
export function reduce(state, action, now) {
  if (!Object.hasOwn(handlers, action?.type)) {
    return reject("INVALID_PAYLOAD");
  }
  return handlers[action.type](state, action, now);
}
