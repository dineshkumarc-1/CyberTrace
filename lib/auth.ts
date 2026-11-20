import { SignJWT, jwtVerify } from "jose";
import { compare } from "bcryptjs";
import { query } from "./db";
export type User = {
  user_id: string;
  name: string;
  email: string;
  role: "Admin" | "Analyst";
  token_version: number;
};
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32 || s.startsWith("REPLACE_"))
    throw new Error("Configure a random SESSION_SECRET (32+ characters)");
  return new TextEncoder().encode(s);
}
export async function token(user: User) {
  return new SignJWT({ v: user.token_version })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.user_id)
    .setIssuedAt()
    .setExpirationTime("8h")
    .setIssuer("cybertrace")
    .setAudience("cybertrace")
    .sign(secret());
}
export async function current(req: Request): Promise<User> {
  const cookie = req.headers.get("cookie") || "";
  const raw = cookie
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("ct_session="))
    ?.slice(11);
  if (!raw) throw new HttpError(401, "Please sign in");
  let p;
  try {
    p = (
      await jwtVerify(raw, secret(), {
        issuer: "cybertrace",
        audience: "cybertrace",
        algorithms: ["HS256"],
      })
    ).payload;
  } catch {
    throw new HttpError(401, "Session expired");
  }
  const u = (
    await query(
      "SELECT user_id,name,email,role,token_version FROM app_users WHERE user_id=$1 AND active",
      [p.sub],
    )
  ).rows[0];
  if (!u || u.token_version !== p.v)
    throw new HttpError(401, "Session revoked");
  return u;
}
export function admin(u: User) {
  if (u.role !== "Admin") throw new HttpError(403, "Admin role required");
}
export function readable(i: any, u: User) {
  return (
    u.role === "Admin" ||
    i.created_by === u.user_id ||
    i.assigned_to === u.user_id
  );
}
export function editable(i: any, u: User) {
  return u.role === "Admin" || i.assigned_to === u.user_id;
}
export function scope(u: User, alias = "i", offset = 1) {
  return u.role === "Admin"
    ? { sql: "TRUE", params: [] }
    : {
        sql: `(${alias}.created_by=$${offset} OR ${alias}.assigned_to=$${offset})`,
        params: [u.user_id],
      };
}
export async function incident(id: string, u: User, write = false) {
  const i = (await query("SELECT * FROM incidents WHERE incident_id=$1", [id]))
    .rows[0];
  if (!i || !readable(i, u)) throw new HttpError(404, "Incident not found");
  if (write && (!editable(i, u) || i.archived))
    throw new HttpError(403, "Incident is archived or not assigned to you");
  return i;
}
export function mutationGuard(req: Request) {
  const origin = process.env.APP_ORIGIN;
  if (!origin) throw new Error("APP_ORIGIN required");
  if (
    req.headers.get("origin") !== origin ||
    req.headers.get("x-cybertrace") !== "1"
  )
    throw new HttpError(403, "Invalid request origin");
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "JSON required");
}
// Process-local throttle: suitable for a single-process mini-project deployment only.
const attempts = new Map<string, { n: number; until: number }>();
export async function login(email: string, password: string) {
  const now = Date.now();
  for (const [k, v] of attempts) if (v.until < now) attempts.delete(k);
  if (attempts.size > 5000) attempts.clear();
  const entry = attempts.get(email);
  if (entry && entry.n >= 8)
    throw new HttpError(429, "Too many attempts; wait 15 minutes");
  const u = (
    await query("SELECT * FROM app_users WHERE email=$1 AND active", [email])
  ).rows[0];
  const ok = await compare(
    password,
    u?.password_hash ||
      "$2b$12$0Q0r2CZpP3j/vF.J9m0rF.4rG6A/0JaUDZhtqxeZ2nZ8ISpCc0D2C",
  );
  if (!u || !ok) {
    attempts.set(email, {
      n: (entry?.n || 0) + 1,
      until: entry?.until || now + 900000,
    });
    throw new HttpError(401, "Invalid email or password");
  }
  attempts.delete(email);
  return u;
}
