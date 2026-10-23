import { useId, useState } from "react";
import { LIMITS } from "../../../shared/events.js";
import { checkText } from "../forms.js";
import styles from "./BacklogPanel.module.css";
import buttons from "./Button.module.css";
import TextField from "./TextField.jsx";

function statusText(story, currentStoryId) {
  if (story.id === currentStoryId) {
    return "Current";
  }
  return story.status === "estimated" ? `Estimated: ${story.finalEstimate}` : "Pending";
}

// One story per line; blank lines are ignored. Problems are reported before anything is sent.
function parseStories(text) {
  const lines = text.split("\n").filter((line) => line.trim() !== "");
  if (lines.length === 0) {
    return { error: "Type at least one story." };
  }
  if (lines.length > LIMITS.storiesPerAdd) {
    return { error: `Add at most ${LIMITS.storiesPerAdd} stories at a time.` };
  }
  const titles = [];
  for (const [index, line] of lines.entries()) {
    const checked = checkText(line, { max: LIMITS.storyTitleMax });
    if (checked.error) {
      return { error: `Line ${index + 1}: ${checked.error}` };
    }
    titles.push(checked.value);
  }
  return { titles };
}

const startsExpanded = () =>
  typeof window.matchMedia !== "function" || window.matchMedia("(min-width: 48rem)").matches;

export default function BacklogPanel({ room, disabled, onAction }) {
  const headingId = useId();
  const contentId = useId();
  const [expanded, setExpanded] = useState(startsExpanded);
  const [text, setText] = useState("");
  const [error, setError] = useState(null);
  const { isFacilitator } = room.me;
  const open = room.room.status !== "ended";
  const stories = [...room.stories].sort((a, b) => a.position - b.position);

  async function handleAdd(event) {
    event.preventDefault();
    const parsed = parseStories(text);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    if (await onAction("story:add", { titles: parsed.titles })) {
      setText("");
    }
  }

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <h2 className={styles.heading} id={headingId}>
        <button
          className={styles.toggle}
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded((current) => !current)}
        >
          Stories ({stories.length})
          {/* Decorative: kept out of the accessible name ("Stories (3)"). */}
          <span className={styles.chevron} aria-hidden="true">
            {expanded ? "▾" : "▸"}
          </span>
        </button>
      </h2>
      <div id={contentId} hidden={!expanded}>
        {stories.length === 0 ? (
          <p className={styles.empty}>No stories yet.</p>
        ) : (
          <ol className={styles.list}>
            {stories.map((story) => (
              <li className={styles.item} key={story.id}>
                <span className={styles.title}>{story.title}</span>
                <span className={styles.status}>{statusText(story, room.room.currentStoryId)}</span>
                {isFacilitator && open && story.id !== room.room.currentStoryId && (
                  <button
                    className={buttons.secondary}
                    type="button"
                    disabled={disabled}
                    aria-label={`Vote on ${story.title}`}
                    onClick={() => onAction("story:select", { storyId: story.id })}
                  >
                    Vote
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
        {isFacilitator && open && (
          <form className={styles.form} onSubmit={handleAdd} noValidate>
            <TextField
              multiline
              label="Add stories"
              hint={`One story per line, up to ${LIMITS.storiesPerAdd} at a time.`}
              name="stories"
              value={text}
              error={error}
              onChange={(event) => {
                setText(event.target.value);
                setError(null);
              }}
            />
            <button className={buttons.secondary} type="submit" disabled={disabled}>
              Add stories
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
