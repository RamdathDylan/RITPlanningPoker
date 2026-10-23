-- The app role (pp_app) gets data access to every table pp_migrator creates, through the
-- default privileges set when the database was created (docker/initdb). That must not include
-- the migration history: a compromised app could otherwise erase it and cause migrations to
-- run again on the next deploy. Only the schema owner may read or change it.
REVOKE ALL ON TABLE schema_migrations FROM pp_app;
