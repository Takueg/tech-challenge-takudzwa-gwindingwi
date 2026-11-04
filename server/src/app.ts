import path from "node:path";
import express from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { logServerError } from "./lib/log-server-error.js";
import { appRouter } from "./routers/index.js";

export const app = express();
app.disable("x-powered-by");
app.use(cors());

app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    onError: logServerError,
  })
);

const clientDist = path.resolve(import.meta.dirname, "../../client/dist");
app.use(express.static(clientDist));
// Lets BrowserRouter deep links survive a refresh.
app.get("*", (_req, res) => res.sendFile(path.join(clientDist, "index.html")));
