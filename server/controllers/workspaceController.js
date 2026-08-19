import prisma from "../configs/prisma.js";

// Get al workspaces for user
export const getUserWorkSpaces = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const workspaces = await prisma.workspace.findMany({
      where: {
        members: { some: { userId: userId } },
      },
      include: {
        members: { include: { user: true } },
        projects: {
          include: {
            tasks: {
              include: {
                assignee: true,
                comments: {
                  include: {
                    user: true,
                  },
                },
              },
            },
            members: { include: { user: true } },
          },
        },
        owner: true,
      },
    });
    res.json(workspaces);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.code || error.message });
  }
};

// add member to workspace
export const addMember = async (req, res) => {
  try {
    const { userId } = await req.auth();
    const { email, role, workspaceId, message } = req.body;

    // check if user exists
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!workspaceId || !role) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (!["ADMIN", "MEMBER"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    // fetch workspace
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { members: true },
    });

    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    // check creator is admin or not
    if (
      !workspace.members.find(
        (member) => member.userId === userId && member.role === "ADMIN",
      )
    ) {
      return res
        .status(403)
        .json({ message: "You dont have admin privileges" });
    }

    // check if user is already a member
    const isMember = workspace.members.some(
      (member) => member.userId === user.id,
    );

    if (isMember) {
      return res
        .status(400)
        .json({ message: "User is already a member of this workspace" });
    }

    // add member to workspace
    const member = await prisma.workspaceMember.create({
      data: {
        userId: user.id,
        workspaceId: workspace.id,
        role: role,
        message,
      },
    });

    res.status(201).json({ message: "Member added successfully", member });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: error.code || error.message });
  }
};
