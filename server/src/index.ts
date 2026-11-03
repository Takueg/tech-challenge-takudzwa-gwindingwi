import { app } from "./app.js";
import { parsePort } from "./lib/config.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;
const PORT = parsePort(process.env.PORT, 4000);

const server = app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

/** Lets requests in flight finish, with a limit so a stuck connection can't block a deploy. */
function shutDown(signal: string): void {
  console.log(`${signal} received, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
}

process.once("SIGTERM", () => shutDown("SIGTERM"));
process.once("SIGINT", () => shutDown("SIGINT"));
