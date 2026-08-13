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
  { id: "update-user-from-clerk", triggers: { event: "clerk/user.updated" } },
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

// Create an array where we'll export future Inngest functions
export const functions = [syncUserCreation, syncUserDeletion, syncUserUpdation];
