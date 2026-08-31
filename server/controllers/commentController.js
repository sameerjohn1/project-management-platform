import prisma from "../configs/prisma.js";

// add comment
export const addComment = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const { content, taskId } = req.body;

    if (!taskId || !content?.trim()) {
      return res
        .status(400)
        .json({ message: "Task ID and content are required" });
    }

    // check user is project member
    const task = await prisma.task.findUnique({
      where: {
        id: taskId,
      },
    });

    if (!task) return res.status(404).json({ message: "Task not found" });

    const project = await prisma.project.findUnique({
      where: { id: task.projectId },
      include: { members: { include: { user: true } } },
    });

    if (!project) return res.status(404).json({ message: "Project not found" });

    const member = project.members.find((m) => m.userId === userId);
    if (!member)
      return res
        .status(403)
        .json({ message: "You are not a member of this project" });

    const comment = await prisma.comment.create({
      data: {
        taskId,
        content,
        userId,
      },
      include: { user: true },
    });

    res.json({ message: "Comment added successfully", comment });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.code || error.message });
  }
};

// get comments for task
export const getTaskComments = async (req, res) => {
  try {
    const { taskId } = req.params;
    const comments = await prisma.comment.findMany({
      where: { taskId },
      include: { user: true },
    });
    res.json({ message: "Comments", comments });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.code || error.message });
  }
};
