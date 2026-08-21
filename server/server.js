import express from "express";
import "dotenv/config";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js";
import workspaceRouter from "./routes/workSpaceRoutes.js";
import { protect } from "./middlewares/authMiddleware.js";

const app = express();
const isVercel = Boolean(process.env.VERCEL);

app.use(express.json());
app.use(cors());
app.use(
  clerkMiddleware({
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  }),
);

app.get("/", (req, res) => {
  res.send("Server is live");
});

app.use("/api/inngest", serve({ client: inngest, functions }));

app.use("/api/workspaces", protect, workspaceRouter);

const PORT = process.env.PORT || 5000;

if (!isVercel) {
  const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });

  process.once("SIGUSR2", () => {
    server.close(() => {
      process.kill(process.pid, "SIGUSR2");
    });
  });

  process.on("SIGINT", () => {
    server.close(() => process.exit(0));
  });

  process.on("SIGTERM", () => {
    server.close(() => process.exit(0));
  });
}

export default app;
