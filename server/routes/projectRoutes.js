import express from "express";
import {
  createProject,
  updateProject,
  addMember,
} from "../controllers/projectController.js";

const projectRouter = express.Router();

// create project
projectRouter.post("/create", createProject);

// update project
projectRouter.put("/update", updateProject);

// add member to project
projectRouter.post("/:projectId/addMember",  addMember);

export default projectRouter;