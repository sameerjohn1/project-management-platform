import { Inngest } from "inngest";
import prisma from "../configs/prisma.js";
import sendEmail from "../configs/nodemailer.js";

// Create a client to send and receive events
export const inngest = new Inngest({ id: "project-management" });

// Inngest function to save user data to database
const syncUserCreation = inngest.createFunction(
  { id: "sync-user-from-clerk", triggers: { event: "clerk/user.created" } },
  async ({ event }) => {
    const { data } = event;
    const primaryEmail =
      data?.email_addresses?.find(
        (email) => email.id === data?.primary_email_address_id,
      )?.email_address || data?.email_addresses?.[0]?.email_address;
    const name =
      [data?.first_name, data?.last_name].filter(Boolean).join(" ") ||
      data?.username ||
      primaryEmail;

    if (!primaryEmail) {
      throw new Error("Clerk user.created event is missing an email address");
    }

    await prisma.user.upsert({
      where: { id: data.id },
      create: {
        id: data.id,
        email: primaryEmail,
        name,
        image: data?.image_url,
      },
      update: {
        email: primaryEmail,
        name,
        image: data?.image_url,
      },
    });
  },
);

// Inngest function to delete user from database
const syncUserDeletion = inngest.createFunction(
  { id: "delete-user-from-clerk", triggers: { event: "clerk/user.deleted" } },
  async ({ event }) => {
    const { data } = event;

    if (!data?.id) {
      throw new Error("Clerk user.deleted event is missing a user id");
    }

    await prisma.user.delete({
      where: { id: data.id },
    });
  },
);

// Inngest function to update user data in database
const syncUserUpdation = inngest.createFunction(
  {
    id: "update-user-from-clerk",
    triggers: { event: "clerk/organization.updated" },
  },
  async ({ event }) => {
    const { data } = event;
    const primaryEmail =
      data?.email_addresses?.find(
        (email) => email.id === data?.primary_email_address_id,
      )?.email_address || data?.email_addresses?.[0]?.email_address;
    const name =
      [data?.first_name, data?.last_name].filter(Boolean).join(" ") ||
      data?.username ||
      primaryEmail;

    if (!data?.id) {
      throw new Error("Clerk user.updated event is missing a user id");
    }

    if (!primaryEmail) {
      throw new Error("Clerk user.updated event is missing an email address");
    }

    await prisma.user.update({
      where: { id: data.id },
      data: {
        email: primaryEmail,
        name,
        image: data?.image_url,
      },
    });
  },
);

// Inngest function to save workspace data to database
const syncWorkspaceCreation = inngest.createFunction(
  {
    id: "sync-workspace-from-clerk",
    triggers: { event: "clerk/organization.created" },
  },
  async ({ event }) => {
    const { data } = event;
    await prisma.workspace.create({
      data: {
        id: data.id,
        name: data.name,
        slug: data.slug,
        ownerId: data.created_by,
        image_url: data.image_url,
      },
    });

    // Add creator as ADMIN member
    await prisma.workspaceMember.create({
      data: {
        userId: data.created_by,
        workspaceId: data.id,
        role: "ADMIN",
      },
    });
  },
);

// Inngest function to update workspace data in database
const syncWorkspaceUpdation = inngest.createFunction(
  {
    id: "sync-workspace-update-from-clerk",
    triggers: { event: "clerk/organization.updated" },
  },

  async ({ event }) => {
    const { data } = event;

    if (!data?.id) {
      throw new Error(
        "Clerk organization.updated event is missing an organization id",
      );
    }

    await prisma.workspace.update({
      where: { id: data.id },
      data: {
        name: data.name,
        slug: data.slug,
        image_url: data.image_url,
      },
    });
  },
);

// Inngest function to delete workspace from database
const syncWorkSpaceDeletion = inngest.createFunction(
  {
    id: "delete-workspace-with-clerk",
    triggers: { event: "clerk/organization.deleted" },
  },
  async ({ event }) => {
    const { data } = event;
    if (!data?.id) {
      throw new Error(
        "Clerk organization.deleted event is missing an organization id",
      );
    }
    await prisma.workspaceMember.deleteMany({
      where: { workspaceId: data.id },
    });
    await prisma.workspace.delete({ where: { id: data.id } });
  },
);

// Inngest function to save workspace member data to database
const syncWorkspaceMemberCreation = inngest.createFunction(
  {
    id: "sync-workspace-member-from-clerk",
    triggers: { event: "clerk/organizationInvitation.accepted" },
  },
  async ({ event }) => {
    const { data } = event;
    await prisma.workspaceMember.create({
      data: {
        userId: data.user_id,
        workspaceId: data.organization_id,
        role: String(data.role_name).toUpperCase(),
      },
    });
  },
);


// Inngest function to send email on task assignment
const sendTaskAssignmentEmail = inngest.createFunction(
  {
    id: "send-task-assignment-mail",
    triggers: { event: "app/task.assigned" },
  },
  async ({ event, step }) => {
    const { taskId, origin } = event.data;

    const task = await step.run("fetch-task", async () => {
      return prisma.task.findUnique({
        where: { id: taskId },
        include: { assignee: true, project: true },
      });
    });

    if (!task) {
      console.error(`Task with ID ${taskId} not found`);
      return;
    }

    await step.run("send-assignment-email", async () => {
      const emailBody = `
        <html>
          <head>
            <style>
              body { font-family: Arial, Helvetica, sans-serif; line-height: 1.6; }
              .container { padding: 20px; }
              .button { background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
            </style>
          </head>
          <body>
            <div class="container">
              <p>Hi ${task.assignee.name},</p>
              <p>You have been assigned a new task:</p>
              <ul>
                <li><strong>Title:</strong> ${task.title}</li>
                <li><strong>Project:</strong> ${task.project.name}</li>
                <li><strong>Due Date:</strong> ${new Date(task.due_date).toLocaleDateString()}</li>
              </ul>
              <p>
                <a href="${origin}" class="button">View Task</a>
              </p>
              <p>Best regards,<br/>Project Management Team</p>
            </div>
          </body>
        </html>
      `;

      await sendEmail({
        to: task.assignee.email,
        subject: `New Task Assignment in ${task.project.name}`,
        html: emailBody,
      });

      console.log(`Assignment email sent to ${task.assignee.email}`);
    });

    const dueDate = new Date(task.due_date);
    const now = new Date();

    if (dueDate > now) {
      await step.sleepUntil("wait-for-due-date", dueDate);

      const latestTask = await step.run("fetch-latest-task", async () => {
        return prisma.task.findUnique({
          where: { id: taskId },
          include: { assignee: true, project: true },
        });
      });

      if (!latestTask) return;

      if (latestTask.status !== "DONE") {
        await step.run("send-task-reminder-mail", async () => {
          const reminderBody = `
            <html>
              <head>
                <style>
                  body { font-family: Arial, Helvetica, sans-serif; line-height: 1.6; }
                  .container { padding: 20px; }
                  .alert { color: #d9534f; font-weight: bold; }
                  .button { background-color: #d9534f; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <p>Hi ${latestTask.assignee.name},</p>
                  <p class="alert">Reminder: Your task is overdue!</p>
                  <p>The following task's due date has passed and it is still not marked as completed:</p>
                  <ul>
                    <li><strong>Title:</strong> ${latestTask.title}</li>
                    <li><strong>Project:</strong> ${latestTask.project.name}</li>
                    <li><strong>Due Date:</strong> ${new Date(latestTask.due_date).toLocaleDateString()}</li>
                    <li><strong>Status:</strong> ${latestTask.status}</li>
                  </ul>
                  <p>Please complete it as soon as possible or update its status.</p>
                  <p>
                    <a href="${origin}" class="button">View Task</a>
                  </p>
                  <p>Best regards,<br/>Project Management Team</p>
                </div>
              </body>
            </html>
          `;

          await sendEmail({
            to: latestTask.assignee.email,
            subject: `Reminder: "${latestTask.title}" is overdue in ${latestTask.project.name}`,
            html: reminderBody,
          });

          console.log(`Reminder email sent to ${latestTask.assignee.email}`);
        });
      }
    }
  }
);

export const functions = [
  syncUserCreation,
  syncUserDeletion,
  syncUserUpdation,
  syncWorkspaceCreation,
  syncWorkspaceUpdation,
  syncWorkSpaceDeletion,
  syncWorkspaceMemberCreation,
  sendTaskAssignmentEmail
];
