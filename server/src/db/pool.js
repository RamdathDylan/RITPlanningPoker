import pg from "pg";

// One shared pool of connections for the app, using the least-privilege role (pp_app).
export function createPool(config) {
  return new pg.Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseSsl ? { rejectUnauthorized: true } : false,
    max: 10,
  });
}
