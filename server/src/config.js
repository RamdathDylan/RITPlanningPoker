const NODE_ENVS = ["development", "test", "production"];

// Each reader returns { value } or { problem }. Problems describe the rule that was broken
// and never echo the value, because values can be secrets (e.g. passwords in DATABASE_URL).
function readNodeEnv(raw = "development") {
  return NODE_ENVS.includes(raw)
    ? { value: raw }
    : { problem: `must be one of ${NODE_ENVS.join(", ")}` };
}

function readInteger(raw, { defaultValue, min, max = Number.MAX_SAFE_INTEGER }) {
  if (raw === undefined) {
    return { value: defaultValue };
  }
  const isWholeNumber = /^\d+$/.test(raw);
  const value = Number(raw);
  if (!isWholeNumber || value < min || value > max) {
    return { problem: `must be a whole number from ${min} to ${max}` };
  }
  return { value };
}

function readBoolean(raw = "false") {
  if (raw === "true" || raw === "false") {
    return { value: raw === "true" };
  }
  return { problem: 'must be "true" or "false"' };
}

function readDatabaseUrl(raw) {
  if (!raw) {
    return { problem: "is required" };
  }
  return /^postgres(ql)?:\/\//.test(raw)
    ? { value: raw }
    : { problem: "must be a postgres:// or postgresql:// URL" };
}

function readClientOrigin(raw, { requireHttps }) {
  if (!raw) {
    return { problem: "is required" };
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    return { problem: "must be a valid URL" };
  }
  const allowedProtocols = requireHttps ? ["https:"] : ["http:", "https:"];
  if (!allowedProtocols.includes(url.protocol)) {
    return { problem: requireHttps ? "must use https in production" : "must use http or https" };
  }
  if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) {
    return { problem: "must be an origin only (scheme, host, optional port) with no path" };
  }
  return { value: url.origin };
}

export function loadConfig(env = process.env) {
  const problems = [];
  const read = (name, result) => {
    if (result.problem) {
      problems.push(`${name} ${result.problem}`);
    }
    return result.value;
  };

  const nodeEnv = read("NODE_ENV", readNodeEnv(env.NODE_ENV));
  const isProduction = nodeEnv === "production";
  const positive = (name, defaultValue) =>
    read(name, readInteger(env[name], { defaultValue, min: 1 }));

  const config = {
    nodeEnv,
    isProduction,
    port: read("PORT", readInteger(env.PORT, { defaultValue: 3000, min: 1, max: 65_535 })),
    clientOrigin: read(
      "CLIENT_ORIGIN",
      readClientOrigin(env.CLIENT_ORIGIN, { requireHttps: isProduction }),
    ),
    databaseUrl: read("DATABASE_URL", readDatabaseUrl(env.DATABASE_URL)),
    databaseSsl: read("DATABASE_SSL", readBoolean(env.DATABASE_SSL)),
    rateLimits: Object.freeze({
      roomCreatesPer10Minutes: positive("RATE_LIMIT_ROOM_CREATES_PER_10_MIN", 5),
      joinsPerMinute: positive("RATE_LIMIT_JOINS_PER_MIN", 60),
      exportsPerMinute: positive("RATE_LIMIT_EXPORTS_PER_MIN", 10),
    }),
    maxLiveRooms: positive("MAX_LIVE_ROOMS", 200),
    handoffMs: positive("HANDOFF_MS", 60_000),
  };

  if (problems.length > 0) {
    throw new Error(`Invalid configuration:\n- ${problems.join("\n- ")}`);
  }
  return Object.freeze(config);
}
