import { getAuth, clerkClient } from "@clerk/express";
import prisma from "../configs/prisma.js";

// Get all workspaces for user
export const getUserWorkSpaces = async (req, res) => {
  try {
    const userId = req.userId || getAuth(req)?.userId;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Auto-sync Clerk Organizations to Prisma DB for local dev compatibility
    try {
      const memberships = await clerkClient.users.getOrganizationMembershipList({ userId });
      const userMemberships = memberships?.data || memberships || [];

      for (const m of userMemberships) {
        const org = m.organization;
        if (!org || !org.id) continue;

        let workspace = await prisma.workspace.findUnique({
          where: { id: org.id },
        });

        if (!workspace) {
          workspace = await prisma.workspace.create({
            data: {
              id: org.id,
              name: org.name || "Workspace",
              slug: org.slug || org.id,
              ownerId: userId,
              image_url: org.imageUrl || "",
            },
          });
        }

        const memberExists = await prisma.workspaceMember.findUnique({
          where: {
            userId_workspaceId: {
              userId: userId,
              workspaceId: org.id,
            },
          },
        });

        if (!memberExists) {
          const roleName = String(m.role || "ADMIN").toUpperCase().replace("ORG:", "");
          const validRole = roleName === "ADMIN" ? "ADMIN" : "MEMBER";
          await prisma.workspaceMember.create({
            data: {
              userId: userId,
              workspaceId: org.id,
              role: validRole,
            },
          });
        }
      }
    } catch (syncErr) {
      console.error("Error auto-syncing Clerk organizations:", syncErr?.message || syncErr);
    }

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
    const userId = req.userId || getAuth(req)?.userId;
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
