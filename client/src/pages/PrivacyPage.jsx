import styles from "./Page.module.css";

const REPOSITORY_URL = "https://github.com/RamdathDylan/RITPlanningPoker";

export default function PrivacyPage() {
  return (
    <main className={`${styles.page} ${styles.prose}`}>
      <h1 className={styles.title}>Privacy</h1>
      <p className={styles.lead}>
        Planning Poker is an independent student project. It is not affiliated with RIT, and it
        collects only what a planning poker session needs.
      </p>

      <h2>What is collected, and why</h2>
      <ul>
        <li>
          <strong>Your display name</strong>, so your team can see who is in the room and who has
          voted. A first name or nickname is enough.
        </li>
        <li>
          <strong>Room names, story titles, votes, and final estimates</strong>, because that is the
          session itself.
        </li>
        <li>
          <strong>Your IP address</strong>, held briefly in the server&apos;s memory to stop floods
          of requests. It is not saved.
        </li>
        <li>
          <strong>A random seat token in this browser</strong> (local storage), so a refresh puts
          you back in your seat. Leaving the room removes it.
        </li>
      </ul>

      <h2>How long it is kept</h2>
      <p>
        A room and everything in it is deleted automatically after 30 days without activity. Nightly
        backups are kept for 7 days, so nothing is kept longer than 37 days. The facilitator can
        delete the room at any time to remove its data immediately.
      </p>

      <h2>What is not collected</h2>
      <p>
        No accounts, emails, student IDs, or real names are required. There are no analytics,
        advertising, or tracking scripts, and no cookies.
      </p>

      <h2>Questions</h2>
      <p>
        To ask a question or report a problem, open an issue on{" "}
        <a href={REPOSITORY_URL}>the project&apos;s GitHub repository</a>. Please don&apos;t include
        anyone&apos;s personal information in a public issue.
      </p>
    </main>
  );
}
