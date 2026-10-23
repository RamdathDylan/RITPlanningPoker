import buttons from "./Button.module.css";
import styles from "./SessionSummary.module.css";

export default function SessionSummary({ stories, onExport }) {
  const ordered = [...stories].sort((a, b) => a.position - b.position);
  return (
    <section className={styles.summary} aria-labelledby="ended-heading">
      <h2 id="ended-heading">This session has ended</h2>
      {onExport && ordered.length > 0 && (
        <button className={buttons.secondary} type="button" onClick={onExport}>
          Download CSV
        </button>
      )}
      {ordered.length === 0 ? (
        <p>No stories were added in this session.</p>
      ) : (
        <table className={styles.table}>
          <caption className={styles.caption}>Estimates</caption>
          <thead>
            <tr>
              <th scope="col">Story</th>
              <th scope="col">Estimate</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((story) => (
              <tr key={story.id}>
                <td>{story.title}</td>
                <td>{story.finalEstimate ?? "Not estimated"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
