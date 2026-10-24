import { Link } from "react-router";
import styles from "./SiteHeader.module.css";
import ThemeSwitch from "./ThemeSwitch.jsx";

export default function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link className={styles.brand} to="/">
          Planning Poker
        </Link>
        <ThemeSwitch />
      </div>
    </header>
  );
}
