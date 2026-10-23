import { LIMITS } from "../../../shared/events.js";
import { accept, reject } from "./results.js";
import { isFacilitator } from "./state.js";

function nextPosition(stories) {
  return stories.reduce((highest, story) => Math.max(highest, story.position + 1), 0);
}

// All or nothing: a pasted list is either fully added or rejected, never half-added.
export function storiesAdded(state, { actorId, stories }) {
  if (!isFacilitator(state, actorId)) {
    return reject("FORBIDDEN");
  }
  if (state.status === "ended") {
    return reject("INVALID_STATE");
  }
  if (state.stories.length + stories.length > LIMITS.storiesPerRoom) {
    return reject("STORY_LIMIT");
  }
  const start = nextPosition(state.stories);
  const added = stories.map(({ id, title }, index) => ({
    id,
    title,
    position: start + index,
    status: "pending",
    finalEstimate: null,
    roundCount: 0,
  }));
  return accept({ ...state, stories: [...state.stories, ...added] });
}
