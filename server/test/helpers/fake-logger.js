// Records log calls in memory so tests can assert what was logged.
export function createFakeLogger() {
  const entries = [];
  const record = (level) => (message, details) => entries.push({ level, message, details });
  return { entries, info: record("info"), error: record("error") };
}
