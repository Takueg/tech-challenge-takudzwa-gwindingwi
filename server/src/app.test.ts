import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "./app.js";
import type { Group, User } from "./lib/db.js";
import { testCaller } from "./test-utils/caller.js";
import { addExpense, makeGroup, makeUser, resetDb, settleUp } from "./test-utils/fixtures.js";

let server: Server;
let alice: User;
let group: Group;

function exportCsv(groupId: string) {
  const { port } = server.address() as AddressInfo;
  return fetch(`http://127.0.0.1:${port}/export/groups/${groupId}.csv`);
}

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  resetDb();
  alice = makeUser("Alice");
  group = makeGroup("Weekend Trip", [alice, makeUser("Bob")]);
});

describe("GET /export/groups/:groupId.csv", () => {
  it("exports the group's expenses oldest first", async () => {
    addExpense(group, alice, 2000, { description: "Later", createdAt: "2026-02-01T00:00:00.000Z" });
    addExpense(group, alice, 1050, { description: "Earlier", category: "Food", createdAt: "2026-01-01T00:00:00.000Z" });

    const response = await exportCsv(group.id);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain('filename="Weekend-Trip.csv"');
    expect((await response.text()).split("\r\n")).toEqual([
      '"Date","Description","Category","Paid by","Amount (EUR)"',
      '"2026-01-01","Earlier","Food","Alice","10.50"',
      '"2026-02-01","Later","Other","Alice","20.00"',
    ]);
  });

  it("leaves other groups' expenses out", async () => {
    addExpense(makeGroup("Other", [alice]), alice, 500, { description: "Elsewhere" });

    expect(await (await exportCsv(group.id)).text()).not.toContain("Elsewhere");
  });

  it("stops a description running as a spreadsheet formula", async () => {
    addExpense(group, alice, 100, { description: "=1+1" });

    expect(await (await exportCsv(group.id)).text()).toContain(`"'=1+1"`);
  });

  it("returns 404 for an unknown group", async () => {
    expect((await exportCsv("missing")).status).toBe(404);
  });

  it("refuses to export an archived group, rather than returning an empty file", async () => {
    addExpense(group, alice, 100);
    settleUp(group);
    await testCaller().groups.archive({ groupId: group.id });

    const response = await exportCsv(group.id);

    expect(response.status).toBe(409);
    expect(await response.text()).toMatch(/archived/i);
  });

  it("exports again once the group is unarchived", async () => {
    addExpense(group, alice, 100, { description: "Dinner" });
    settleUp(group);
    await testCaller().groups.archive({ groupId: group.id });
    await testCaller().groups.unarchive({ groupId: group.id });

    const response = await exportCsv(group.id);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Dinner");
  });
});
