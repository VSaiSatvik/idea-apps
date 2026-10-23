/**
 * Accounts shared by all five apps (one backend).
 * - email + password (scrypt), bearer tokens
 * - DELETE /auth/me removes the account AND the user's data in every module
 *   (Apple 5.1.1(v) and Google Play both require in-app account deletion)
 * - ADMIN_EMAILS (comma-separated) get the admin role (Vouch organiser, SideDesk ops)
 * - demo accounts for store reviewers are seeded at start-up
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import { persisted } from "./persist.js";

export interface User {
  id: string;
  email: string;
  name: string;
  salt: string;
  hash: string;
  createdAt: string;
  apps: string[];
}

class Users {
  users = new Map<string, User>();
  tokens = new Map<string, string>(); // token -> userId
}

const db = persisted("users", () => new Users());
const deletionHooks: ((userId: string) => void)[] = [];

export function onAccountDeleted(fn: (userId: string) => void) {
  deletionHooks.push(fn);
}

const hashPw = (pw: string, salt: string) => scryptSync(pw, salt, 32).toString("hex");
const newId = (p: string) => `${p}_${randomBytes(6).toString("hex")}`;

export function isAdmin(u: User) {
  return (process.env.ADMIN_EMAILS ?? "admin@demo.app").toLowerCase().split(",").map((s) => s.trim()).includes(u.email.toLowerCase());
}

export function createUser(email: string, password: string, name: string, app = "unknown"): User {
  email = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpError(400, "Enter a valid email");
  if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters");
  if ([...db.value.users.values()].some((u) => u.email === email)) throw new HttpError(409, "An account with this email already exists");
  const salt = randomBytes(16).toString("hex");
  const u: User = { id: newId("u"), email, name: name.trim() || email.split("@")[0], salt, hash: hashPw(password, salt), createdAt: new Date().toISOString(), apps: [app] };
  db.value.users.set(u.id, u);
  db.save();
  return u;
}

export function issueToken(u: User) {
  const t = randomBytes(24).toString("base64url");
  db.value.tokens.set(t, u.id);
  db.save();
  return t;
}

export function userByEmail(email: string) {
  return [...db.value.users.values()].find((u) => u.email === email.trim().toLowerCase());
}

export function userById(id: string) {
  return db.value.users.get(id);
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export function requireUser(req: Request, _res: Response, next: NextFunction) {
  const t = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  const id = t ? db.value.tokens.get(t) : undefined;
  const u = id ? db.value.users.get(id) : undefined;
  if (!u) return next(new HttpError(401, "Please sign in"));
  req.user = u;
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user || !isAdmin(req.user)) return next(new HttpError(403, "Admins only"));
  next();
}

export const publicUser = (u: User) => ({ id: u.id, email: u.email, name: u.name, admin: isAdmin(u) });

export function authRouter() {
  const r = express.Router();
  r.post("/signup", (req, res) => {
    const u = createUser(String(req.body.email ?? ""), String(req.body.password ?? ""), String(req.body.name ?? ""), String(req.body.app ?? "unknown"));
    res.status(201).json({ token: issueToken(u), user: publicUser(u) });
  });
  r.post("/login", (req, res) => {
    const u = userByEmail(String(req.body.email ?? ""));
    const ok = u && timingSafeEqual(Buffer.from(hashPw(String(req.body.password ?? ""), u.salt), "hex"), Buffer.from(u.hash, "hex"));
    if (!u || !ok) throw new HttpError(401, "Wrong email or password");
    const app = String(req.body.app ?? "");
    if (app && !u.apps.includes(app)) { u.apps.push(app); db.save(); }
    res.json({ token: issueToken(u), user: publicUser(u) });
  });
  r.get("/me", requireUser, (req, res) => res.json(publicUser(req.user!)));
  r.delete("/me", requireUser, (req, res) => {
    const id = req.user!.id;
    for (const h of deletionHooks) h(id);
    db.value.users.delete(id);
    for (const [t, uid] of db.value.tokens) if (uid === id) db.value.tokens.delete(t);
    db.save();
    res.json({ deleted: true });
  });
  return r;
}

/** Seed reviewer/demo accounts (password from DEMO_PASSWORD, default shown in the launch guide). */
export function seedDemoAccounts(emails: { email: string; name: string }[]) {
  const pw = process.env.DEMO_PASSWORD ?? "ReviewDemo2026!";
  return emails.map(({ email, name }) => userByEmail(email) ?? createUser(email, pw, name, "demo"));
}

export function resetUsersForTests() {
  db.value.users.clear();
  db.value.tokens.clear();
}
