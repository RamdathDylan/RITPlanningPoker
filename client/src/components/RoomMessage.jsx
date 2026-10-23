import { Link } from "react-router";
import styles from "../pages/Page.module.css";

// A full-page explanation for states where the room can't be shown (no blank screens).
export default function RoomMessage({ title, children, linkTo, linkText }) {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{title}</h1>
      {children && <p className={styles.lead}>{children}</p>}
      <Link to={linkTo}>{linkText}</Link>
    </main>
  );
}
