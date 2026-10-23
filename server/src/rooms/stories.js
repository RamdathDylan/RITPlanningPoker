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

// Starts a new round on the chosen story. Any open round is abandoned (its votes are dropped).
export function storySelected(state, { actorId, storyId, roundId }) {
  if (!isFacilitator(state, actorId)) {
    return reject("FORBIDDEN");
  }
  if (state.status === "ended") {
    return reject("INVALID_STATE");
  }
  const story = state.stories.find((candidate) => candidate.id === storyId);
  if (!story) {
    return reject("NOT_FOUND");
  }
  const number = story.roundCount + 1;
  return accept({
    ...state,
    status: "voting",
    currentStoryId: storyId,
    stories: state.stories.map((candidate) =>
      candidate.id === storyId ? { ...candidate, roundCount: number } : candidate,
    ),
    round: { id: roundId, storyId, number, votes: {}, revealedAt: null },
  });
}
