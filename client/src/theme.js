// The chosen theme: "system" follows the device, "light" or "dark" overrides it. Saved per
// browser as a convenience; storage can be blocked, so every access is guarded.
const STORAGE_KEY = "pp:theme";
export const THEMES = ["system", "light", "dark"];

export function loadTheme() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(saved) ? saved : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(theme) {
  if (theme === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Not remembered in this browser; the theme still applies for this visit.
  }
}
