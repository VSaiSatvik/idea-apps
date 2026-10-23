import express, { type NextFunction, type Request, type Response } from "express";
import { HttpError, authRouter, seedDemoAccounts } from "./lib/auth.js";
import { circlesRouter } from "./circles/router.js";
import { seedSideDeskDemo, sidedeskRouter } from "./sidedesk/router.js";
import { shieldRouter, type PushSender } from "./shield/router.js";
import { seedVouchDemo, vouchRouter } from "./vouch/router.js";
import { seedWaslDemo, waslPublicRouter, waslRouter } from "./wasl/router.js";

export const DEMO_ACCOUNTS = [
  { email: "review@demo.app", name: "App Reviewer" },
  { email: "venue@demo.app", name: "Demo Venue" },
  { email: "creator@demo.app", name: "Demo Creator" },
  { email: "business@demo.app", name: "Demo Business" },
  { email: "student@demo.app", name: "Demo Student" },
  { email: "admin@demo.app", name: "Demo Admin" },
];

export function seedDemo() {
  const [review, venue, creator, business, student] = seedDemoAccounts(DEMO_ACCOUNTS);
  seedWaslDemo(review.id);
  seedVouchDemo(venue.id, creator.id);
  seedSideDeskDemo(business.id, student.id);
}

export function createApp(opts: { push?: PushSender } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    // the apps call from native code; allow the Expo web preview too
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  app.use(express.json({ limit: "1mb" }));
  app.get("/health", (_req, res) => res.json({ ok: true, at: new Date().toISOString() }));
  app.use("/auth", authRouter());
  app.use("/circles", circlesRouter());
  app.use("/wasl", waslPublicRouter());
  app.use("/wasl", waslRouter());
  app.use("/vouch", vouchRouter());
  app.use("/sidedesk", sidedeskRouter());
  app.use("/shield", shieldRouter(opts.push));
  app.use((_req, _res, next) => next(new HttpError(404, "Not found")));
  app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
    // engine validation errors are plain Errors with user-readable messages -> 400
    const status = err instanceof HttpError ? err.status : err.status ?? 400;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: err.message });
  });
  return app;
}
