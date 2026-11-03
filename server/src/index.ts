import express from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers/index.js";
import { db } from "./lib/db.js";

const app = express();
app.use(cors());

app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
  })
);

// Plain REST route, not tRPC — file downloads don't fit the RPC-over-fetch
// shape tRPC expects, so this bypasses it entirely.
function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

app.get("/export/groups/:groupId.csv", (req, res) => {
  const group = db.groups.get(req.params.groupId);
  if (!group) {
    res.status(404).send("Group not found");
    return;
  }

  const expenses = Array.from(db.expenses.values())
    .filter((e) => e.groupId === group.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const rows = [
    ["Date", "Description", "Category", "Paid by", "Amount (EUR)"],
    ...expenses.map((e) => [
      e.createdAt.slice(0, 10),
      e.description,
      e.category,
      e.paidByUserName,
      (e.amountCents / 100).toFixed(2),
    ]),
  ];

  const csv = rows.map((row) => row.map(csvField).join(",")).join("\r\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${group.name.replace(/[^a-z0-9]+/gi, "-")}.csv"`);
  res.send(csv);
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
