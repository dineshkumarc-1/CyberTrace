"use client";
import { useEffect, useState, FormEvent } from "react";
type Any = any;
const severity = ["Low", "Medium", "High", "Critical"],
  statuses = ["Open", "Investigating", "Contained", "Resolved", "Closed"];
async function api(path: string, method = "GET", data?: Any) {
  const r = await fetch("/api/" + path, {
    method,
    headers:
      method === "GET"
        ? {}
        : { "content-type": "application/json", "x-cybertrace": "1" },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const b = await r.json();
  if (!r.ok)
    throw new Error(b.details?.join("; ") || b.error || "Request failed");
  return b;
}
const date = (v: string) =>
  new Date(v).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
function Badge({ value }: { value: string }) {
  return <span className={"badge " + value.replaceAll(" ", "")}>{value}</span>;
}
function Field({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      {name}
      {children}
    </label>
  );
}
function Empty({ text = "No records yet." }: { text?: string }) {
  return <div className="empty">{text}</div>;
}
export default function App() {
  const [user, U] = useState<Any>(undefined),
    [view, S] = useState("dashboard"),
    [selected, I] = useState<string | null>(null),
    [error, E] = useState(""),
    [notice, N] = useState(""),
    [busy, B] = useState(false),
    [look, L] = useState<Any>({
      assets: [],
      vulnerabilities: [],
      techniques: [],
      users: [],
    }),
    [refresh, R] = useState(0);
  useEffect(() => {
    api("auth/me")
      .then((x) => U(x.user))
      .catch(() => U(null));
  }, []);
  useEffect(() => {
    if (user)
      api("lookups")
        .then(L)
        .catch((e) => E(e.message));
  }, [user, refresh]);
  async function act(fn: () => Promise<void>) {
    E("");
    N("");
    B(true);
    try {
      await fn();
    } catch (e: Any) {
      E(e.message);
    } finally {
      B(false);
    }
  }
  function nav(v: string, id: string | null = null) {
    S(v);
    I(id);
    E("");
    N("");
  }
  const props = {
    user,
    look,
    busy,
    act,
    notify: N,
    nav,
    refresh,
    reload: () => R((x) => x + 1),
  };
  if (user === undefined)
    return <main className="main">Loading CyberTrace…</main>;
  if (!user)
    return (
      <div className="login">
        <aside>
          <div className="brand">
            Cyber<span>Trace</span>
          </div>
          <div className="eyebrow" style={{ color: "#8fb8ff", marginTop: 50 }}>
            Incident intelligence
          </div>
          <h1>
            Every incident.
            <br />A lesson for the next.
          </h1>
          <p>
            Track investigations, connect evidence, and retrieve the knowledge
            your team already has.
          </p>
          <small style={{ color: "#a9bddb", marginTop: 40 }}>
            DBMS Level 3 · Synthetic training environment
          </small>
        </aside>
        <main>
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              act(async () => {
                const r = await api(
                  "auth/login",
                  "POST",
                  Object.fromEntries(f),
                );
                U(r.user);
              });
            }}
          >
            <div>
              <div className="eyebrow">Secure workspace</div>
              <h1 style={{ marginTop: 12 }}>Welcome back</h1>
              <p className="muted">Sign in to your incident workspace.</p>
            </div>
            {error && (
              <div role="alert" className="notice error">
                {error}
              </div>
            )}
            <Field name="Email address">
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
              />
            </Field>
            <Field name="Password">
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={72}
              />
            </Field>
            <button className="primary" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <footer>
              Accounts are provisioned by an administrator.
              <br />
              Seed credentials are configured locally, not embedded in code.
            </footer>
          </form>
        </main>
      </div>
    );
  return (
    <div className="shell">
      <aside className="sidebar">
        <div>
          <div className="brand">
            Cyber<span>Trace</span>
          </div>
          <small>Security operations workspace</small>
        </div>
        <nav className="nav" aria-label="Main navigation">
          {[
            ["dashboard", "Overview"],
            ["incidents", "Incidents"],
            ["search", "Knowledge search"],
            ...(user.role === "Admin" ? [["admin", "Administration"]] : []),
          ].map(([id, title]) => (
            <button
              key={id}
              className={view === id ? "active" : ""}
              onClick={() => nav(id)}
            >
              {title}
            </button>
          ))}
        </nav>
        <div className="muted">
          <small>
            CONNECTED KNOWLEDGE
            <br />
            <br />
            Relational integrity
            <br />
            Flexible evidence
            <br />
            Semantic retrieval
          </small>
        </div>
        <footer>
          <div>
            <strong>{user.name}</strong>
            <br />
            <small>{user.role}</small>
          </div>
          <button
            onClick={() =>
              act(async () => {
                await api("auth/logout", "POST", {});
                U(null);
              })
            }
          >
            Sign out
          </button>
        </footer>
      </aside>
      <main className="main">
        <header className="topbar">
          <span>
            <span className="statusdot" />
            CyberTrace /{" "}
            {view === "incidents" && selected
              ? "Incident workspace"
              : view === "search"
                ? "Knowledge retrieval"
                : view === "admin"
                  ? "Administration"
                  : "Security operations"}
          </span>
          <span>Synthetic data · Mini-project edition</span>
        </header>
        {error && (
          <div role="alert" className="notice error">
            {error}
          </div>
        )}
        {notice && (
          <div role="status" className="notice success">
            {notice}
          </div>
        )}
        {view === "dashboard" && <Dashboard {...props} />}
        {view === "incidents" &&
          (selected ? (
            <Detail key={selected} id={selected} {...props} />
          ) : (
            <Incidents {...props} />
          ))}
        {view === "create" && <Create {...props} />}
        {view === "search" && <Search {...props} />}
        {view === "admin" && <Admin {...props} />}
      </main>
    </div>
  );
}
function Dashboard(p: Any) {
  const [d, D] = useState<Any>(null);
  useEffect(() => {
    p.act(async () => D(await api("dashboard")));
  }, [p.refresh]);
  if (!d) return <Empty text="Loading overview…" />;
  const total = d.groups.reduce((n: number, r: Any) => n + r.total, 0),
    open = d.groups
      .filter((r: Any) => !["Resolved", "Closed"].includes(r.status))
      .reduce((n: number, r: Any) => n + r.total, 0),
    critical = d.groups
      .filter(
        (r: Any) =>
          r.severity === "Critical" &&
          !["Resolved", "Closed"].includes(r.status),
      )
      .reduce((n: number, r: Any) => n + r.total, 0);
  return (
    <>
      <div className="heading">
        <div>
          <div className="eyebrow">Operational picture</div>
          <h1>Incident overview</h1>
          <p>Your team's incidents, priorities, and investigation workload.</p>
        </div>
        <button className="primary" onClick={() => p.nav("create")}>
          + New incident
        </button>
      </div>
      <section className="stats">
        {[
          ["Total incidents", total],
          ["Unresolved", open],
          ["Critical · unresolved", critical],
          ["Resolved / closed", total - open],
        ].map(([t, n]) => (
          <div className="card stat" key={t}>
            <span>{t}</span>
            <strong>{n}</strong>
            <small>Within your authorized scope</small>
          </div>
        ))}
      </section>
      <div className="two">
        <section className="card">
          <h2>Workload by status</h2>
          <div className="metricrows">
            {statuses.map((s) => (
              <div className="row" key={s}>
                <Badge value={s} />
                <strong>
                  {d.groups
                    .filter((r: Any) => r.status === s)
                    .reduce((n: number, r: Any) => n + r.total, 0)}
                </strong>
              </div>
            ))}
          </div>
        </section>
        <section className="card">
          <div className="eyebrow">Knowledge retrieval</div>
          <h2 style={{ marginTop: 12 }}>
            Find the incident you remember.
            <br />
            Even without the exact words.
          </h2>
          <p className="muted lede">
            Search investigation findings and remediation knowledge by meaning.
            Results link back to their original incident and source text.
          </p>
          <button onClick={() => p.nav("search")}>
            Explore historical incidents →
          </button>
          <p className="indexnote">
            Embeddings must be generated by the local worker before semantic
            results are available.
          </p>
        </section>
      </div>
      <section className="card">
        <h2>Recently detected</h2>
        <IncidentTable rows={d.recent} nav={p.nav} />
      </section>
    </>
  );
}
function IncidentTable({ rows, nav }: { rows: Any[]; nav: Any }) {
  return rows.length ? (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th>Incident</th>
            <th>Severity</th>
            <th>Status</th>
            <th>Detected</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((i) => (
            <tr key={i.incident_id}>
              <td>
                <button
                  className="link"
                  onClick={() => nav("incidents", i.incident_id)}
                >
                  {i.title}
                </button>
                {i.assignee_name && (
                  <div>
                    <small>
                      {i.assignee_name} · {i.asset_count} assets
                    </small>
                  </div>
                )}
              </td>
              <td>
                <Badge value={i.severity} />
              </td>
              <td>
                <Badge value={i.status} />
              </td>
              <td>{date(i.detected_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty text="No matching incidents." />
  );
}
function Incidents(p: Any) {
  const [d, D] = useState<Any>(null),
    [q, Q] = useState(""),
    [sev, V] = useState(""),
    [status, T] = useState(""),
    [page, P] = useState(1),
    [archive, A] = useState(false);
  async function load() {
    D(
      await api(
        "incidents?" +
          new URLSearchParams({
            q,
            severity: sev,
            status,
            page: String(page),
            archived: String(archive),
          }),
      ),
    );
  }
  useEffect(() => {
    p.act(load);
  }, [sev, status, page, archive, p.refresh]);
  return (
    <>
      <div className="heading">
        <div>
          <div className="eyebrow">Case management</div>
          <h1>Incidents</h1>
          <p>Track investigations from first detection to closure.</p>
        </div>
        <button className="primary" onClick={() => p.nav("create")}>
          + New incident
        </button>
      </div>
      <section className="card">
        <form
          className="filters"
          onSubmit={(e) => {
            e.preventDefault();
            if (page !== 1) P(1);
            else p.act(load);
          }}
        >
          <input
            aria-label="Keyword search"
            placeholder="Search title or description…"
            value={q}
            onChange={(e) => Q(e.target.value)}
          />
          <select
            aria-label="Filter severity"
            value={sev}
            onChange={(e) => {
              V(e.target.value);
              P(1);
            }}
          >
            <option value="">All severities</option>
            {severity.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <select
            aria-label="Filter status"
            value={status}
            onChange={(e) => {
              T(e.target.value);
              P(1);
            }}
          >
            <option value="">All statuses</option>
            {statuses.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <button disabled={p.busy}>Search</button>
          <button
            type="button"
            onClick={() => {
              A(!archive);
              P(1);
            }}
          >
            {archive ? "Show active" : "Show archived"}
          </button>
        </form>
      </section>
      <section className="card">
        {d ? (
          <>
            <IncidentTable rows={d.rows} nav={p.nav} />
            <div className="pagination">
              <small>
                {d.total} incidents · Page {page}
              </small>
              <div className="actions">
                <button
                  disabled={page === 1 || p.busy}
                  onClick={() => P(page - 1)}
                >
                  Previous
                </button>
                <button
                  disabled={page * 15 >= d.total || p.busy}
                  onClick={() => P(page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : (
          <Empty text="Loading incidents…" />
        )}
      </section>
    </>
  );
}
function Create(p: Any) {
  return (
    <>
      <div className="heading">
        <div>
          <div className="eyebrow">New investigation</div>
          <h1>Create incident</h1>
          <p>
            Save the incident and related entity links in one SQL transaction.
          </p>
        </div>
        <button onClick={() => p.nav("incidents")}>Cancel</button>
      </div>
      <form
        className="card formgrid"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          p.act(async () => {
            const b: Any = {
              title: f.get("title"),
              description: f.get("description"),
              severity: f.get("severity"),
              detected_at: new Date(
                f.get("detected_at") as string,
              ).toISOString(),
              assets: f.getAll("assets"),
              vulnerabilities: f.getAll("vulnerabilities"),
              techniques: f.getAll("techniques"),
            };
            if (p.user.role === "Admin")
              b.assigned_to = f.get("assigned_to") || null;
            const i = await api("incidents", "POST", b);
            p.reload();
            p.nav("incidents", i.incident_id);
          });
        }}
      >
        <label className="full">
          Incident title
          <input name="title" required minLength={3} maxLength={200} />
        </label>
        <Field name="Severity">
          <select name="severity">
            {severity.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
        <Field name="Detected at (your local time)">
          <input
            name="detected_at"
            type="datetime-local"
            defaultValue={new Date(
              Date.now() - new Date().getTimezoneOffset() * 60000,
            )
              .toISOString()
              .slice(0, 16)}
            required
          />
        </Field>
        {p.user.role === "Admin" && (
          <Field name="Assigned analyst">
            <select name="assigned_to">
              <option value="">Unassigned</option>
              {p.look.users.map((u: Any) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <label className="full">
          Description
          <textarea
            name="description"
            required
            minLength={10}
            maxLength={20000}
          />
        </label>
        {["assets", "vulnerabilities", "techniques"].map((kind) => (
          <div className="full" key={kind}>
            <h3>{kind[0].toUpperCase() + kind.slice(1)}</h3>
            <div className="chips">
              {p.look[kind].map((r: Any) => (
                <label
                  className="chipcheck"
                  key={r.asset_id || r.vulnerability_id || r.technique_id}
                >
                  <input
                    type="checkbox"
                    name={kind}
                    value={r.asset_id || r.vulnerability_id || r.technique_id}
                  />
                  {r.asset_name || r.name || r.technique_name}
                </label>
              ))}
            </div>
          </div>
        ))}
        <div className="full">
          <button className="primary" disabled={p.busy}>
            Create incident
          </button>
        </div>
      </form>
    </>
  );
}
function Detail(p: Any) {
  const [d, D] = useState<Any>(null),
    [tab, T] = useState("Overview"),
    [logs, G] = useState<Any>(null),
    [lp, LP] = useState(1),
    [editing, ED] = useState<Any>(null);
  async function load() {
    D(await api("incidents/" + p.id));
  }
  useEffect(() => {
    p.act(load);
  }, [p.id, p.refresh]);
  useEffect(() => {
    if (tab === "Logs")
      p.act(async () => G(await api(`incidents/${p.id}/logs?page=${lp}`)));
  }, [tab, lp, p.refresh]);
  if (!d) return <Empty text="Loading incident…" />;
  const i = d.incident,
    can =
      (p.user.role === "Admin" || i.assigned_to === p.user.user_id) &&
      !i.archived;
  const patch = (b: Any) =>
    p.act(async () => {
      await api("incidents/" + p.id, "PATCH", { ...b, version: i.version });
      await load();
      p.notify("Incident updated.");
    });
  const submit = (
    e: FormEvent<HTMLFormElement>,
    path: string,
    convert?: (f: FormData) => Any,
  ) => {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form);
    p.act(async () => {
      await api(
        `incidents/${p.id}/${path}`,
        "POST",
        convert ? convert(f) : Object.fromEntries(f),
      );
      form.reset();
      await load();
      p.reload();
      p.notify("Saved. Embedding indexing is handled by the worker.");
    });
  };
  return (
    <>
      <button className="link" onClick={() => p.nav("incidents")}>
        ← All incidents
      </button>
      <div className="heading">
        <div>
          <div className="eyebrow">Investigation workspace</div>
          <h1>{i.title}</h1>
          <div className="actions">
            <Badge value={i.severity} />
            <Badge value={i.status} />
            {i.archived && <Badge value="Archived" />}
            <small>Detected {date(i.detected_at)}</small>
          </div>
        </div>
        {p.user.role === "Admin" && (
          <button onClick={() => patch({ archived: !i.archived })}>
            {i.archived ? "Restore incident" : "Archive incident"}
          </button>
        )}
      </div>
      <div className="tabs">
        {[
          "Overview",
          "Reports",
          "Logs",
          "Remediation",
          "History & indexing",
        ].map((t) => (
          <button
            className={tab === t ? "active" : ""}
            key={t}
            onClick={() => T(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Overview" && (
        <>
          <section className="card">
            <h2>Incident details</h2>
            <p className="report">{i.description}</p>
            <small>
              Created {date(i.created_at)} · Updated {date(i.updated_at)} ·
              Version {i.version}
            </small>
            {can && (
              <form
                className="formgrid"
                style={{ marginTop: 24 }}
                key={i.version}
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  patch({
                    title: f.get("title"),
                    description: f.get("description"),
                    severity: f.get("severity"),
                    status: f.get("status"),
                    ...(p.user.role === "Admin"
                      ? { assigned_to: f.get("assigned_to") || null }
                      : {}),
                  });
                }}
              >
                <Field name="Title">
                  <input
                    name="title"
                    defaultValue={i.title}
                    required
                    minLength={3}
                  />
                </Field>
                <Field name="Severity">
                  <select name="severity" defaultValue={i.severity}>
                    {severity.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
                <Field name="Status">
                  <select name="status" defaultValue={i.status}>
                    {statuses.map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </Field>
                {p.user.role === "Admin" && (
                  <Field name="Assignment">
                    <select
                      name="assigned_to"
                      defaultValue={i.assigned_to || ""}
                    >
                      <option value="">Unassigned</option>
                      {p.look.users.map((u: Any) => (
                        <option key={u.user_id} value={u.user_id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
                <label className="full">
                  Description
                  <textarea
                    name="description"
                    defaultValue={i.description}
                    required
                    minLength={10}
                  />
                </label>
                <div className="full">
                  <small>
                    Allowed: Open → Investigating → Contained → Resolved →
                    Closed. Resolved/Closed may reopen to Investigating.
                  </small>
                </div>
                <button className="primary" disabled={p.busy}>
                  Save changes
                </button>
              </form>
            )}
          </section>
          <div className="two">
            {["assets", "vulnerabilities", "techniques"].map((kind) => (
              <section className="card" key={kind}>
                <h2>{kind[0].toUpperCase() + kind.slice(1)}</h2>
                {d[kind].map((r: Any) => (
                  <div
                    className="row listitem"
                    key={r.asset_id || r.vulnerability_id || r.technique_id}
                  >
                    <span>{r.asset_name || r.name || r.technique_name}</span>
                    {can && (
                      <button
                        onClick={() =>
                          p.act(async () => {
                            await api(`incidents/${p.id}/links`, "DELETE", {
                              kind,
                              id:
                                r.asset_id ||
                                r.vulnerability_id ||
                                r.technique_id,
                            });
                            await load();
                          })
                        }
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
                {!d[kind].length && <Empty />}
                {can && (
                  <form
                    className="actions"
                    style={{ marginTop: 16 }}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      p.act(async () => {
                        await api(`incidents/${p.id}/links`, "POST", {
                          kind,
                          id: f.get("id"),
                        });
                        await load();
                      });
                    }}
                  >
                    <select aria-label={"Link " + kind} name="id" required>
                      <option value="">Select record…</option>
                      {p.look[kind].map((r: Any) => (
                        <option
                          key={
                            r.asset_id || r.vulnerability_id || r.technique_id
                          }
                          value={
                            r.asset_id || r.vulnerability_id || r.technique_id
                          }
                        >
                          {r.asset_name || r.name || r.technique_name}
                        </option>
                      ))}
                    </select>
                    <button disabled={p.busy}>Link record</button>
                  </form>
                )}
              </section>
            ))}
          </div>
        </>
      )}
      {tab === "Reports" && (
        <>
          <section className="card">
            <h2>Investigation reports</h2>
            {!d.reports.length && <Empty />}
            {d.reports.map((r: Any) => (
              <article className="listitem" key={r._id}>
                <div className="row">
                  <h3>{r.summary}</h3>
                  {can && <button onClick={() => ED(r)}>Edit report</button>}
                </div>
                <p className="report">{r.detailed_report}</p>
                <p>
                  <strong>Remediation findings:</strong>{" "}
                  {r.remediation_summary || "Not recorded"}
                </p>
                {r.analyst_notes.map((n: Any, k: number) => (
                  <p key={k} className="notice">
                    Analyst note: {n.text}
                  </p>
                ))}
                <small>
                  Version {r.version} · {date(r.updated_at)}
                </small>
              </article>
            ))}
          </section>
          {can && (
            <form
              key={editing?._id || "new"}
              className="card stack"
              onSubmit={(e) => {
                if (!editing) return submit(e, "reports");
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                p.act(async () => {
                  await api(
                    `incidents/${p.id}/reports/${editing._id}`,
                    "PATCH",
                    { ...Object.fromEntries(f), version: editing.version },
                  );
                  ED(null);
                  await load();
                  p.notify("Report updated. Reindex it using the worker.");
                });
              }}
            >
              <h2>{editing ? "Edit report" : "Add investigation report"}</h2>
              <Field name="Summary">
                <input
                  name="summary"
                  defaultValue={editing?.summary}
                  required
                  minLength={5}
                />
              </Field>
              <Field name="Detailed findings">
                <textarea
                  name="detailed_report"
                  defaultValue={editing?.detailed_report}
                  required
                  minLength={10}
                />
              </Field>
              <Field name="Remediation summary">
                <textarea
                  name="remediation_summary"
                  defaultValue={editing?.remediation_summary}
                />
              </Field>
              <Field name="New analyst note (optional)">
                <input name="note" />
              </Field>
              <div className="actions">
                <button className="primary" disabled={p.busy}>
                  Save report
                </button>
                {editing && (
                  <button type="button" onClick={() => ED(null)}>
                    Cancel edit
                  </button>
                )}
              </div>
            </form>
          )}
        </>
      )}
      {tab === "Logs" && (
        <>
          <section className="card">
            <h2>Incident logs</h2>
            {logs && (
              <>
                <div className="chips">
                  {logs.groups.map((g: Any) => (
                    <span className="badge" key={g._id}>
                      {g._id}: {g.total}
                    </span>
                  ))}
                </div>
                <div className="tablewrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>Time</th>
                        <th>Message / raw data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.rows.map((l: Any) => (
                        <tr key={l._id}>
                          <td>
                            {l.event_type}
                            <br />
                            <small>{l.source_ip}</small>
                          </td>
                          <td>{date(l.event_time)}</td>
                          <td>
                            {l.message}
                            <pre className="code">
                              {JSON.stringify(l.raw_data, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!logs.rows.length && <Empty />}
                <div className="pagination">
                  <small>
                    {logs.total} logs · Page {lp}
                  </small>
                  <div className="actions">
                    <button disabled={lp === 1} onClick={() => LP(lp - 1)}>
                      Previous
                    </button>
                    <button
                      disabled={lp * 15 >= logs.total}
                      onClick={() => LP(lp + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
          {can && (
            <form
              className="card formgrid"
              onSubmit={(e) =>
                submit(e, "logs", (f) => ({
                  event_type: f.get("event_type"),
                  event_time: new Date(
                    f.get("event_time") as string,
                  ).toISOString(),
                  ...(f.get("source_ip")
                    ? { source_ip: f.get("source_ip") }
                    : {}),
                  message: f.get("message"),
                  raw_data: JSON.parse((f.get("raw_data") as string) || "{}"),
                }))
              }
            >
              <h2 className="full">Add sample log</h2>
              <Field name="Event type">
                <input name="event_type" required minLength={2} />
              </Field>
              <Field name="Event time">
                <input type="datetime-local" name="event_time" required />
              </Field>
              <Field name="Source IP (optional)">
                <input name="source_ip" />
              </Field>
              <Field name="Message">
                <input name="message" required />
              </Field>
              <label className="full">
                Raw data (JSON object)
                <textarea name="raw_data" defaultValue="{}" />
              </label>
              <button className="primary" disabled={p.busy}>
                Save log
              </button>
            </form>
          )}
        </>
      )}
      {tab === "Remediation" && (
        <>
          <section className="card">
            <h2>Remediation tasks</h2>
            {!d.remediations.length && <Empty />}
            {d.remediations.map((r: Any) => (
              <div className="listitem" key={r.remediation_id}>
                <div className="row">
                  <h3>{r.action}</h3>
                  <Badge value={r.status} />
                </div>
                <p>{r.description}</p>
                {r.completed_at && (
                  <small>Completed {date(r.completed_at)}</small>
                )}
                {can && (
                  <div className="actions">
                    {["Pending", "In Progress", "Completed"]
                      .filter((s) => s !== r.status)
                      .map((s) => (
                        <button
                          key={s}
                          disabled={p.busy}
                          onClick={() =>
                            p.act(async () => {
                              await api(
                                `incidents/${p.id}/remediations/${r.remediation_id}`,
                                "PATCH",
                                { status: s },
                              );
                              await load();
                            })
                          }
                        >
                          Mark {s}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </section>
          {can && (
            <form
              className="card stack"
              onSubmit={(e) => submit(e, "remediations")}
            >
              <h2>Add remediation task</h2>
              <Field name="Action">
                <input name="action" required minLength={3} />
              </Field>
              <Field name="Description">
                <textarea name="description" />
              </Field>
              <button className="primary" disabled={p.busy}>
                Add task
              </button>
            </form>
          )}
        </>
      )}
      {tab === "History & indexing" && (
        <>
          <section className="card">
            <h2>Status history</h2>
            {!d.history.length && <Empty text="No status changes recorded." />}
            {d.history.map((h: Any) => (
              <div className="listitem" key={h.history_id}>
                {h.old_status} → <strong>{h.new_status}</strong>
                <br />
                <small>
                  {h.actor_name} · {date(h.changed_at)}
                </small>
              </div>
            ))}
          </section>
          <section className="card">
            <div className="row">
              <h2>Embedding jobs</h2>
              {can && (
                <button
                  disabled={p.busy}
                  onClick={() =>
                    p.act(async () => {
                      await api(`incidents/${p.id}/retry`, "POST", {});
                      await load();
                      p.notify(
                        "Current failed jobs queued for retry. Start the worker to process them.",
                      );
                    })
                  }
                >
                  Retry failed jobs
                </button>
              )}
            </div>
            <p className="muted">
              Run the embedding service and worker to process pending jobs.
              Older superseded jobs can remain failed without affecting current
              content.
            </p>
            {d.jobs.map((j: Any) => (
              <div className="row listitem" key={j.job_id}>
                <span>
                  #{j.job_id} · {j.source_type}
                  <br />
                  <small>{j.error || `${j.attempts} attempts`}</small>
                </span>
                <Badge value={j.status} />
              </div>
            ))}
          </section>
        </>
      )}
    </>
  );
}
function Search(p: Any) {
  const [q, Q] = useState(""),
    [d, D] = useState<Any>(null),
    [sev, V] = useState(""),
    [status, T] = useState("");
  return (
    <>
      <div className="heading">
        <div>
          <div className="eyebrow">Historical intelligence</div>
          <h1>Knowledge search</h1>
          <p>
            Describe the situation. Find related investigations and remediation.
          </p>
        </div>
      </div>
      <section className="card">
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            p.act(async () =>
              D(
                await api("search", "POST", {
                  q,
                  ...(sev ? { severity: sev } : {}),
                  ...(status ? { status } : {}),
                }),
              ),
            );
          }}
        >
          <div className="searchbox">
            <input
              aria-label="Semantic search query"
              placeholder="e.g. Employee entered credentials on a fake sign-in page"
              value={q}
              onChange={(e) => Q(e.target.value)}
              required
              minLength={3}
              maxLength={1000}
            />
            <button className="primary" disabled={p.busy}>
              {p.busy ? "Searching…" : "Find similar incidents"}
            </button>
          </div>
          <div className="filters">
            <select
              aria-label="Search severity"
              value={sev}
              onChange={(e) => V(e.target.value)}
            >
              <option value="">All severities</option>
              {severity.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              aria-label="Search status"
              value={status}
              onChange={(e) => T(e.target.value)}
            >
              <option value="">All statuses</option>
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
        </form>
        <p className="indexnote">
          Cosine similarity ranks textual relevance, not attack certainty.
          Results are limited to incidents you can access.
        </p>
      </section>
      {d ? (
        <section className="card">
          <h2>{d.rows.length} related incidents</h2>
          {!d.rows.length && (
            <Empty text="No indexed incidents match your access scope and filters. Run the worker or try keyword search." />
          )}
          {d.rows.map((r: Any) => (
            <article className="result" key={r.incident_id}>
              <div className="row">
                <button
                  className="link"
                  onClick={() => p.nav("incidents", r.incident_id)}
                >
                  {r.title}
                </button>
                <small>Similarity {Number(r.similarity).toFixed(3)}</small>
              </div>
              <div className="actions">
                <Badge value={r.severity} />
                <Badge value={r.status} />
                <small>Source: {r.source_type}</small>
              </div>
              <p className="report" style={{ marginTop: 12 }}>
                {r.content_text}
              </p>
            </article>
          ))}
          <small>Model: {d.model}</small>
        </section>
      ) : (
        <div className="notice">
          Try a description rather than an exact incident title. Compare these
          results with the keyword search on the Incidents page.
        </div>
      )}
    </>
  );
}
function Admin(p: Any) {
  const [users, U] = useState<Any[]>([]),
    [kind, K] = useState("assets"),
    [edit, ED] = useState<Any>(null);
  async function load() {
    U((await api("admin/users")).rows);
  }
  useEffect(() => {
    p.act(load);
  }, [p.refresh]);
  const fields: Any = {
    assets: [
      "asset_name",
      "asset_type",
      "criticality",
      "owner_name",
      "location",
    ],
    vulnerabilities: [
      "cve_id",
      "name",
      "severity",
      "description",
      "published_date",
    ],
    techniques: ["technique_name", "mitre_id", "description"],
  };
  return (
    <>
      <div className="heading">
        <div>
          <div className="eyebrow">Access & reference data</div>
          <h1>Administration</h1>
          <p>Manage team access and the entities linked to investigations.</p>
        </div>
      </div>
      <section className="card">
        <h2>Team members</h2>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Role</th>
                <th>State</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_id}>
                  <td>
                    {u.name}
                    <br />
                    <small>{u.email}</small>
                  </td>
                  <td>{u.role}</td>
                  <td>{u.active ? "Active" : "Disabled"}</td>
                  <td>
                    {u.user_id !== p.user.user_id && (
                      <div className="actions">
                        <button
                          disabled={p.busy}
                          onClick={() =>
                            p.act(async () => {
                              await api("admin/users/" + u.user_id, "PATCH", {
                                active: !u.active,
                              });
                              await load();
                            })
                          }
                        >
                          {u.active ? "Disable" : "Enable"}
                        </button>
                        <button
                          disabled={p.busy}
                          onClick={() =>
                            p.act(async () => {
                              await api("admin/users/" + u.user_id, "PATCH", {
                                role: u.role === "Admin" ? "Analyst" : "Admin",
                              });
                              await load();
                            })
                          }
                        >
                          Make {u.role === "Admin" ? "Analyst" : "Admin"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <form
        className="card formgrid"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget,
            f = new FormData(form);
          p.act(async () => {
            await api("admin/users", "POST", Object.fromEntries(f));
            form.reset();
            await load();
            p.reload();
            p.notify("User created.");
          });
        }}
      >
        <h2 className="full">Create account</h2>
        <Field name="Name">
          <input name="name" required />
        </Field>
        <Field name="Email">
          <input name="email" type="email" required autoComplete="off" />
        </Field>
        <Field name="Initial password (12–72 characters)">
          <input
            name="password"
            type="password"
            minLength={12}
            maxLength={72}
            required
            autoComplete="new-password"
          />
        </Field>
        <Field name="Role">
          <select name="role">
            <option>Analyst</option>
            <option>Admin</option>
          </select>
        </Field>
        <button disabled={p.busy} className="primary">
          Create user
        </button>
      </form>
      <section className="card">
        <div className="row">
          <h2>Reference data</h2>
          <select
            aria-label="Reference type"
            style={{ width: 200 }}
            value={kind}
            onChange={(e) => {
              K(e.target.value);
              ED(null);
            }}
          >
            {["assets", "vulnerabilities", "techniques"].map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </div>
        {p.look[kind].map((r: Any) => {
          const id = r.asset_id || r.vulnerability_id || r.technique_id;
          return (
            <div className="listitem row" key={id}>
              <span>{r.asset_name || r.name || r.technique_name}</span>
              <div className="actions">
                <button onClick={() => ED(r)}>Edit</button>
                <button
                  className="danger"
                  disabled={p.busy}
                  onClick={() => {
                    if (
                      confirm(
                        "Delete this reference? Referenced records cannot be deleted.",
                      )
                    )
                      p.act(async () => {
                        await api(
                          `admin/references/${kind}/${id}`,
                          "DELETE",
                          {},
                        );
                        p.reload();
                        p.notify("Reference deleted.");
                      });
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </section>
      <form
        key={
          kind +
          (edit?.asset_id ||
            edit?.vulnerability_id ||
            edit?.technique_id ||
            "new")
        }
        className="card formgrid"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget,
            f = new FormData(form),
            b: Any = Object.fromEntries(f);
          for (const k of ["cve_id", "mitre_id", "published_date"])
            if (k in b && !b[k]) b[k] = null;
          p.act(async () => {
            const id =
              edit?.asset_id || edit?.vulnerability_id || edit?.technique_id;
            await api(
              `admin/references/${kind}` + (id ? "/" + id : ""),
              id ? "PATCH" : "POST",
              b,
            );
            ED(null);
            form.reset();
            p.reload();
            p.notify("Reference saved.");
          });
        }}
      >
        <h2 className="full">
          {edit ? "Edit" : "Add"} {kind}
        </h2>
        {fields[kind].map((f: string) => (
          <Field key={f} name={f.replaceAll("_", " ")}>
            {["severity", "criticality"].includes(f) ? (
              <select name={f} defaultValue={edit?.[f] || "Medium"}>
                {severity.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            ) : f === "description" ? (
              <textarea name={f} defaultValue={edit?.[f] || ""} required />
            ) : (
              <input
                name={f}
                type={f === "published_date" ? "date" : "text"}
                defaultValue={
                  edit?.[f]?.slice?.(
                    0,
                    f === "published_date" ? 10 : undefined,
                  ) || ""
                }
                required={!["cve_id", "mitre_id", "published_date"].includes(f)}
              />
            )}
          </Field>
        ))}
        <div className="full actions">
          <button className="primary" disabled={p.busy}>
            Save reference
          </button>
          {edit && (
            <button type="button" onClick={() => ED(null)}>
              Cancel
            </button>
          )}
        </div>
      </form>
    </>
  );
}
