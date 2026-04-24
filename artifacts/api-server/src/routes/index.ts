import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tasksRouter from "./tasks";
import statsRouter from "./stats";
import trackerRouter from "./tracker";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/tasks", tasksRouter);
router.use("/stats", statsRouter);
router.use("/tracker", trackerRouter);

export default router;
