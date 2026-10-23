import styles from "./Page.module.css";

export default function LandingPage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Planning Poker</h1>
      <p className={styles.lead}>
        Estimate user stories together in real time. Everyone votes face down, then the facilitator
        reveals the cards.
      </p>
    </main>
  );
}
