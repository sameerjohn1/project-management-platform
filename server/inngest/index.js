import { Inngest } from "inngest";
import prisma from "../configs/prisma.js";

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

export const functions = [
  syncUserCreation,
  syncUserDeletion,
  syncUserUpdation,
  syncWorkspaceCreation,
  syncWorkspaceUpdation,
  syncWorkSpaceDeletion,
];
