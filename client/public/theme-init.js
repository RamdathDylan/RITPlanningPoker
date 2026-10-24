// Applies a saved Light/Dark choice before the page draws, so it never flashes the wrong theme.
// A separate file (not inline) because the Content-Security-Policy forbids inline scripts.
try {
  const saved = window.localStorage.getItem("pp:theme");
  if (saved === "light" || saved === "dark") {
    document.documentElement.dataset.theme = saved;
  }
} catch {
  // Storage blocked: follow the device setting.
}
