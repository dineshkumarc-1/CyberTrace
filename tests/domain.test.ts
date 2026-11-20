import test from "node:test";
import assert from "node:assert/strict";
import {
  incidentCreate,
  incidentPatch,
  logCreate,
  userCreate,
} from "../lib/validation";
import { chunks } from "../lib/indexing";
import { readable, editable, mutationGuard } from "../lib/auth";
const user: any = { user_id: "u1", role: "Analyst" },
  i = { created_by: "u1", assigned_to: "u2" };
test("Analysts read created incidents but edit only assigned incidents", () => {
  assert.ok(readable(i, user));
  assert.equal(editable(i, user), false);
  assert.ok(editable({ ...i, assigned_to: "u1" }, user));
});
test("Non-members cannot read incidents", () =>
  assert.equal(readable({ ...i, created_by: "u3" }, user), false));
test("Admin can read and edit incidents", () => {
  assert.ok(readable(i, { ...user, role: "Admin" }));
  assert.ok(editable(i, { ...user, role: "Admin" }));
});
test("Unknown incident fields and short description rejected", () => {
  assert.equal(
    incidentCreate.safeParse({
      title: "X",
      description: "short",
      severity: "Low",
      detected_at: new Date().toISOString(),
      admin: true,
    }).success,
    false,
  );
});
test("Optimistic update version required", () =>
  assert.equal(incidentPatch.safeParse({ status: "Open" }).success, false));
test("Invalid source IP rejected", () =>
  assert.equal(
    logCreate.safeParse({
      event_type: "test",
      event_time: new Date().toISOString(),
      message: "x",
      source_ip: "999.1.1.1",
    }).success,
    false,
  ));
test("Weak account password rejected", () =>
  assert.equal(
    userCreate.safeParse({
      name: "Test",
      email: "test@example.test",
      password: "short",
      role: "Admin",
    }).success,
    false,
  ));
test("Chunk windows preserve source coverage", () => {
  const s = Array.from({ length: 1400 }, (_, i) => String(i % 10)).join("");
  const c = chunks(s);
  assert.ok(c.every((x) => x.length <= 500));
  assert.equal(c[0], s.slice(0, 500));
  assert.equal(c[1], s.slice(420, 920));
  assert.ok(c.at(-1)?.endsWith(s.slice(-20)));
});
test("Cross-origin mutation rejected", () => {
  process.env.APP_ORIGIN = "http://localhost:3000";
  assert.throws(() =>
    mutationGuard(
      new Request("http://localhost:3000/api/test", {
        method: "POST",
        headers: {
          origin: "https://evil.test",
          "content-type": "application/json",
          "x-cybertrace": "1",
        },
      }),
    ),
  );
});
