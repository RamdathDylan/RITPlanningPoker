import { Link } from "react-router";
import styles from "./SiteFooter.module.css";

export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <p>
        Independent student project, not affiliated with RIT. <Link to="/privacy">Privacy</Link>
      </p>
    </footer>
  );
}
