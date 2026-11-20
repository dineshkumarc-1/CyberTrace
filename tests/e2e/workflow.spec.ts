import "dotenv/config";
import { test, expect } from "@playwright/test";
const origin = process.env.APP_ORIGIN || "http://localhost:3000";
async function login(
  page: any,
  email = "admin@cybertrace.test",
  password = process.env.SEED_ADMIN_PASSWORD,
) {
  await page.goto("/");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Incident overview" }),
  ).toBeVisible();
}
test("Admin creates incident, records evidence, changes status and manages links", async ({
  page,
}) => {
  await login(page);
  await page.screenshot({
    path: "docs/screenshots/01-dashboard.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "+ New incident" }).click();
  await page
    .getByLabel("Incident title")
    .fill("E2E synthetic credential incident");
  await page
    .getByLabel("Description", { exact: true })
    .fill("An employee entered credentials into a counterfeit sign-in page.");
  await page
    .getByLabel("Assigned analyst")
    .selectOption({ label: "Maya Analyst" });
  await page
    .getByRole("button", { name: "Create incident", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "E2E synthetic credential incident" }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("Investigating");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toContainText("Incident updated");
  await page.getByRole("button", { name: "Reports", exact: true }).click();
  await page
    .getByLabel("Summary", { exact: true })
    .fill("Credential exposure confirmed in training environment");
  await page
    .getByLabel("Detailed findings")
    .fill(
      "Synthetic investigation found unauthorized account access after credential capture.",
    );
  await page
    .getByLabel("Remediation summary")
    .fill("Revoke sessions, reset password and enable MFA.");
  await page.getByRole("button", { name: "Save report" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Credential exposure confirmed in training environment",
    }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/03-reports.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Logs", exact: true }).click();
  await page
    .getByLabel("Event type", { exact: true })
    .fill("authentication_anomaly");
  await page.getByLabel("Event time", { exact: true }).fill("2026-10-15T10:00");
  await page
    .getByLabel("Message", { exact: true })
    .fill("Synthetic account session detected");
  await page.getByRole("button", { name: "Save log" }).click();
  await expect(
    page.getByRole("cell", { name: "authentication_anomaly" }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/04-logs.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Remediation", exact: true }).click();
  await page
    .getByLabel("Action", { exact: true })
    .fill("Revoke account sessions");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Invalidate test sessions after password reset.");
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(
    page.getByRole("heading", { name: "Revoke account sessions" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Mark Completed" }).click();
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "History & indexing" }).click();
  await expect(
    page.getByText("Workspace Admin ·", { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/05-history-indexing.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Overview", exact: true })
    .last()
    .click();
  await page
    .getByLabel("Link assets")
    .selectOption({ label: "Identity gateway" });
  await page.getByRole("button", { name: "Link record" }).first().click();
  await expect(
    page.getByText("Identity gateway", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Remove", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Remove", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: "docs/screenshots/02-incident.png",
    fullPage: true,
  });
});
test("Analyst authorization and request integrity", async ({
  page,
  request,
}) => {
  await login(
    page,
    "analyst@cybertrace.test",
    process.env.SEED_ANALYST_PASSWORD,
  );
  await expect(
    page.getByRole("button", { name: "Administration", exact: true }),
  ).toHaveCount(0);
  const admin = await page.request.get("/api/admin/users");
  expect(admin.status()).toBe(403);
  const noOrigin = await page.request.post("/api/incidents", { data: {} });
  expect(noOrigin.status()).toBe(403);
  const rows = await (await page.request.get("/api/incidents")).json();
  const id = rows.rows[0].incident_id;
  const assign = await page.request.patch("/api/incidents/" + id, {
    headers: { origin, "x-cybertrace": "1" },
    data: { assigned_to: null, version: rows.rows[0].version },
  });
  expect(assign.status()).toBe(403);
  const denied = await page.request.get(
    "/api/incidents/00000000-0000-4000-8000-000000000001",
  );
  expect(denied.status()).toBe(404);
  const xss = await page.request.post("/api/incidents", {
    headers: { origin, "x-cybertrace": "1" },
    data: {
      title: "Invalid",
      description: "long enough text",
      severity: "Impossible",
      detected_at: new Date().toISOString(),
    },
  });
  expect(xss.status()).toBe(400);
  const csrf = await request.post("/api/auth/login", {
    headers: { origin: "https://evil.test", "x-cybertrace": "1" },
    data: { email: "admin@cybertrace.test", password: "invalid" },
  });
  expect(csrf.status()).toBe(403);
});
test("Desktop and mobile pages remain usable", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Incidents", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Incidents", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/06-incidents.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Administration" }).click();
  await expect(
    page.getByRole("heading", { name: "Administration" }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/07-admin.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Incident overview" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "docs/screenshots/08-mobile.png",
    fullPage: true,
  });
});
test("Semantic search returns incident sources", async ({ page }) => {
  await login(page);
  await page
    .getByRole("button", { name: "Knowledge search", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Semantic search query" })
    .fill("Employee gave their password to a counterfeit login website");
  await page.getByRole("button", { name: "Find similar incidents" }).click();
  await expect(page.getByText(/related incidents$/)).toBeVisible({
    timeout: 90000,
  });
  await expect(page.locator(".result")).not.toHaveCount(0);
  await page.screenshot({
    path: "docs/screenshots/09-search.png",
    fullPage: true,
  });
});
test("Real cross-user records, optimistic conflicts and search permissions", async ({
  page,
}) => {
  await login(page);
  const all = await (await page.request.get("/api/incidents")).json();
  const lookup = await (await page.request.get("/api/lookups")).json();
  const other = lookup.users.find((u: any) => u.name === "Noah Analyst");
  const outsider = all.rows.find(
    (i: any) =>
      i.assigned_to === other.user_id && i.created_by === other.user_id,
  );
  expect(outsider).toBeTruthy();
  const candidate = all.rows[0];
  const stale = await page.request.patch(
    "/api/incidents/" + candidate.incident_id,
    {
      headers: { origin, "x-cybertrace": "1" },
      data: { title: candidate.title, version: candidate.version + 100 },
    },
  );
  expect(stale.status()).toBe(409);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByLabel("Email address").fill("analyst@cybertrace.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.SEED_ANALYST_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Incident overview" }),
  ).toBeVisible();
  const forbidden = await page.request.get(
    "/api/incidents/" + outsider.incident_id,
  );
  expect(forbidden.status()).toBe(404);
  const results = await page.request.post("/api/search", {
    headers: { origin, "x-cybertrace": "1" },
    data: { q: "Suspicious employee password capture" },
  });
  expect(results.status()).toBe(200);
  const data = await results.json();
  expect(data.rows.length).toBeGreaterThan(0);
  for (const r of data.rows) {
    expect(r.incident_id).not.toBe(outsider.incident_id);
    expect(
      (await page.request.get("/api/incidents/" + r.incident_id)).status(),
    ).toBe(200);
  }
});
test("Admin account/reference operations and report version editing", async ({
  page,
}) => {
  await login(page);
  const headers = { origin, "x-cybertrace": "1" };
  const suffix = Date.now().toString();
  const create = await page.request.post("/api/admin/users", {
    headers,
    data: {
      name: "Temporary E2E Analyst",
      email: `test-${suffix}@cybertrace.test`,
      password: crypto.randomUUID(),
      role: "Analyst",
    },
  });
  expect(create.status()).toBe(201);
  const user = await create.json();
  const promote = await page.request.patch("/api/admin/users/" + user.user_id, {
    headers,
    data: { role: "Admin" },
  });
  expect(promote.status()).toBe(200);
  const disable = await page.request.patch("/api/admin/users/" + user.user_id, {
    headers,
    data: { active: false, role: "Analyst" },
  });
  expect(disable.status()).toBe(200);
  const ref = await page.request.post("/api/admin/references/assets", {
    headers,
    data: {
      asset_name: "Temporary E2E asset " + suffix,
      asset_type: "Endpoint",
      criticality: "Low",
      owner_name: "Test team",
      location: "Isolated lab",
    },
  });
  expect(ref.status()).toBe(201);
  const asset = await ref.json();
  const editRef = await page.request.patch(
    "/api/admin/references/assets/" + asset.asset_id,
    {
      headers,
      data: {
        asset_name: asset.asset_name,
        asset_type: "Server",
        criticality: "Medium",
        owner_name: "Test team",
        location: "Isolated lab",
      },
    },
  );
  expect(editRef.status()).toBe(200);
  expect(
    (
      await page.request.delete(
        "/api/admin/references/assets/" + asset.asset_id,
        { headers, data: {} },
      )
    ).status(),
  ).toBe(200);
  const list = await (await page.request.get("/api/incidents")).json();
  let target: any;
  for (const r of list.rows) {
    const detail = await (
      await page.request.get("/api/incidents/" + r.incident_id)
    ).json();
    if (detail.reports.length) {
      target = detail;
      break;
    }
  }
  expect(target).toBeTruthy();
  const report = target.reports[0],
    data = {
      summary: report.summary,
      detailed_report: report.detailed_report + " Version-edit test.",
      remediation_summary: report.remediation_summary,
      note: "Synthetic version-edit verification.",
      version: report.version,
    };
  const path = `/api/incidents/${target.incident.incident_id}/reports/${report._id}`;
  expect((await page.request.patch(path, { headers, data })).status()).toBe(
    200,
  );
  expect((await page.request.patch(path, { headers, data })).status()).toBe(
    409,
  );
});
