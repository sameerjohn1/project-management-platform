import express from "express";
import {
  createTask,
  deleteTask,
  updateTask,
} from "../controllers/taskController.js";

const taskRouter = express.Router();

taskRouter.post("/", createTask);
taskRouter.put("/:id", updateTask);
taskRouter.delete("/bulk", deleteTask);
taskRouter.delete("/:id", deleteTask);

export default taskRouter;
