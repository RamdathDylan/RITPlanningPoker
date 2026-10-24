import { useState } from "react";
import { THEMES, applyTheme, loadTheme } from "../theme.js";
import styles from "./ThemeSwitch.module.css";

const LABELS = { system: "System", light: "Light", dark: "Dark" };

// Native radio buttons: arrow keys move between the options, and changing theme is harmless,
// so radios' "selection follows focus" behaviour is what we want here.
export default function ThemeSwitch() {
  const [theme, setTheme] = useState(loadTheme);

  function choose(next) {
    setTheme(next);
    applyTheme(next);
  }

  return (
    <fieldset className={styles.switch}>
      <legend className={styles.legend}>Theme</legend>
      {THEMES.map((option) => (
        <label className={styles.option} key={option}>
          <input
            className={styles.radio}
            type="radio"
            name="theme"
            value={option}
            checked={theme === option}
            onChange={() => choose(option)}
          />
          <span>{LABELS[option]}</span>
        </label>
      ))}
    </fieldset>
  );
}
