import { Router, type IRouter } from "express";
import authRouter from "./auth";
import usersRouter from "./users";
import projectsRouter from "./projects";
import requirementsRouter from "./requirements";
import statsRouter from "./stats";
import { requireTrackerAuth } from "../../middlewares/requireTrackerAuth";

const router: IRouter = Router();

router.use("/auth", authRouter);
router.use("/users", requireTrackerAuth, usersRouter);
router.use("/projects", requireTrackerAuth, projectsRouter);
router.use("/requirements", requireTrackerAuth, requirementsRouter);
router.use("/stats", requireTrackerAuth, statsRouter);

export default router;
