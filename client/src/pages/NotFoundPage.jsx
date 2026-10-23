import { Link } from "react-router";
import styles from "./Page.module.css";

export default function NotFoundPage() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Page not found</h1>
      <p className={styles.lead}>That page doesn&apos;t exist. Check the link and try again.</p>
      <Link to="/">Go to the home page</Link>
    </main>
  );
}
