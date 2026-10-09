import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import { loadTrackerUser } from "./middlewares/requireTrackerAuth";
import router from "./routes";
import { logger } from "./lib/logger";
import { MySqlSessionStore } from "./lib/sessionStore";

const sessionSecret = process.env.SESSION_SECRET;

if (!sessionSecret) {
  throw new Error(
    "SESSION_SECRET environment variable is required but was not provided.",
  );
}

if (sessionSecret.length < 32) {
  logger.warn(
    "SESSION_SECRET is shorter than 32 characters; use a long random value in production.",
  );
}

const app: Express = express();

// Behind a reverse proxy (nginx, load balancer), trust X-Forwarded-Proto so
// req.secure reflects the client's HTTPS connection for the session cookie.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    name: "tracker.sid",
    secret: sessionSecret,
    store: new MySqlSessionStore(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      // Secure-only over HTTPS, still works over plain HTTP (local dev).
      secure: "auto",
      maxAge: 1000 * 60 * 60 * 24 * 14,
    },
  }),
);
app.use(loadTrackerUser);

app.use("/api", router);

// Global error handler — returns JSON so the frontend can show the real message
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status ?? err.statusCode ?? 500;
  const message = err.message ?? "Internal server error";
  logger.error({ err }, message);
  res.status(status).json({ error: message });
});

export default app;
