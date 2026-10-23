function serializeValue(value) {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

function serializeDetails(details) {
  return Object.fromEntries(
    Object.entries(details).map(([key, value]) => [key, serializeValue(value)]),
  );
}

// One JSON object per line, so logs are easy to search and to filter by level.
export function createLogger({ stream = process.stderr, now = () => new Date() } = {}) {
  const write =
    (level) =>
    (message, details = {}) => {
      const entry = { time: now().toISOString(), level, message, ...serializeDetails(details) };
      stream.write(`${JSON.stringify(entry)}\n`);
    };
  return { info: write("info"), error: write("error") };
}
