import { verifyToken, clerkClient } from "@clerk/express";
import prisma from "../configs/prisma.js";

export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    if (!token || token === "null" || token === "undefined") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    let userId;
    try {
      const decoded = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });
      userId = decoded?.sub;
    } catch (tokenErr) {
      console.log("Token verification failed:", tokenErr.message);
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.userId = userId;

    // Ensure user exists in database
    let user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      try {
        const clerkUser = await clerkClient.users.getUser(userId);
        if (clerkUser) {
          const primaryEmail =
            clerkUser.emailAddresses?.find(
              (e) => e.id === clerkUser.primaryEmailAddressId,
            )?.emailAddress ||
            clerkUser.emailAddresses?.[0]?.emailAddress ||
            "";
          const name =
            [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
            clerkUser.username ||
            primaryEmail;

          await prisma.user.upsert({
            where: { id: userId },
            create: {
              id: userId,
              email: primaryEmail,
              name,
              image: clerkUser.imageUrl || "",
            },
            update: {
              email: primaryEmail,
              name,
              image: clerkUser.imageUrl || "",
            },
          });
        }
      } catch (userErr) {
        console.error("Error auto-syncing user to DB:", userErr);
      }
    }

    return next();
  } catch (error) {
    console.log("Protect error:", error);
    return res.status(500).json({ message: error.code || error.message });
  }
};
