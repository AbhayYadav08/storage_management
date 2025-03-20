// "use server";

// import { ID, Query } from "node-appwrite";
// import { createAdminClient, createSessionClient } from "../appwrite";
// import { appwriteConfig } from "../appwrite/config";
// import { parseStringify } from "../utils";
// import { cookies } from "next/headers";
// import { avatarPlaceholderUrl } from "@/constants";
// import { redirect } from "next/navigation";

// const getUserByEmail = async (email: string) => {
//   const { databases } = await createAdminClient();

//   console.log("Database ID", appwriteConfig.databaseId);

//   const result = await databases.listDocuments(
//     appwriteConfig.databaseId,
//     appwriteConfig.userscollectionId,
//     [
//       Query.equal(
//         "email",

//         email
//       ),
//     ]
//   );

//   return result.total > 0 ? result.documents[0] : null;
// };

// const handleError = (error: unknown, message: string) => {
//   console.log(error, message);
//   throw error;
// };

// export const sendEmailOTP = async ({ email }: { email: string }) => {
//   const { account } = await createAdminClient();

//   try {
//     const session = await account.createEmailToken(ID.unique(), email);

//     return session.userId;
//   } catch (error) {
//     handleError(error, "Failed to send email OTP");
//   }
// };

// export const createAccount = async ({
//   fullName,
//   email,
// }: {
//   fullName: string;
//   email: string;
// }) => {
//   const existingUser = await getUserByEmail(email);

//   const accountId = await sendEmailOTP({ email });

//   if (!accountId) throw new Error("Failed to send an OTP");

//   if (!existingUser) {
//     const { databases } = await createAdminClient();

//     await databases.createDocument(
//       appwriteConfig.databaseId,
//       appwriteConfig.userscollectionId,
//       ID.unique(),
//       {
//         fullName,
//         email,
//         avatar: avatarPlaceholderUrl,
//         accountId,
//       }
//     );
//   }

//   return parseStringify({ accountId });
// };

// export const verifySecret = async ({
//   accountId,
//   password,
// }: {
//   accountId: string;
//   password: string;
// }) => {
//   try {
//     const { account } = await createAdminClient();
//     const session = await account.createSession(accountId, password);

//     (await cookies()).set("appwrite-session", session.secret, {
//       path: "/",
//       httpOnly: true,
//       sameSite: "strict",
//       secure: true,
//     });
//     return parseStringify({ sessionId: session.$id });
//   } catch (error) {
//     handleError(error, "Failed to verify OTP");
//   }
// };

// export const getCurrentUser = async () => {
//   const { databases, account } = await createSessionClient();

//   const result = await account.get();

//   const user = await databases.listDocuments(
//     appwriteConfig.databaseId,
//     appwriteConfig.userscollectionId,
//     [Query.equal("accountId", result.$id)]
//   );

//   if (user.total <= 0) {
//     return null;
//   } else {
//     return parseStringify(user.documents[0]);
//   }
// };

// export const signOutUser = async () => {
//   const { account } = await createSessionClient();
//   try {
//     await account.deleteSession("current");
//     (await cookies()).delete("appwrite-session");
//     console.log("User logged out successfully");
//   } catch (error) {
//     handleError(error, "Failed to sign out user");
//   } finally {
//     redirect("/sign-in");
//   }
// };

"use server";

import { ID, Query } from "node-appwrite";
import { createAdminClient, createSessionClient } from "../appwrite";
import { appwriteConfig } from "../appwrite/config";
import { parseStringify } from "../utils";
import { cookies } from "next/headers";
import { avatarPlaceholderUrl } from "@/constants";
import { redirect } from "next/navigation";

const getUserByEmail = async (email: string) => {
  const { databases } = await createAdminClient();

  console.log("Database ID:", appwriteConfig.databaseId);

  const result = await databases.listDocuments(
    appwriteConfig.databaseId,
    appwriteConfig.userscollectionId,
    [Query.equal("email", email)]
  );

  return result.total > 0 ? result.documents[0] : null;
};

const handleError = (error: unknown, message: string) => {
  console.error(message, error);
  throw error;
};

export const sendEmailOTP = async ({ email }: { email: string }) => {
  const { account } = await createAdminClient();

  try {
    const session = await account.createEmailToken(ID.unique(), email);
    return session.userId;
  } catch (error) {
    handleError(error, "Failed to send email OTP");
  }
};

export const createAccount = async ({
  fullName,
  email,
}: {
  fullName: string;
  email: string;
}) => {
  const existingUser = await getUserByEmail(email);
  const accountId = await sendEmailOTP({ email });

  if (!accountId) throw new Error("Failed to send an OTP");

  if (!existingUser) {
    const { databases } = await createAdminClient();
    await databases.createDocument(
      appwriteConfig.databaseId,
      appwriteConfig.userscollectionId,
      ID.unique(),
      {
        fullName,
        email,
        avatar: avatarPlaceholderUrl,
        accountId,
      }
    );
  }

  return parseStringify({ accountId });
};

export const verifySecret = async ({
  accountId,
  password,
}: {
  accountId: string;
  password: string;
}) => {
  try {
    const { account } = await createAdminClient();
    const session = await account.createSession(accountId, password);

    console.log("Session Secret:", session.secret); // Debug log

    (await cookies()).set("appwrite-session", session.secret, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production", // Prevent local issues
    });

    return parseStringify({ sessionId: session.$id });
  } catch (error) {
    handleError(error, "Failed to verify OTP");
  }
};

export const getCurrentUser = async () => {
  try {
    const session = (await cookies()).get("appwrite-session");

    console.log("Retrieved Session:", session); // Debug log

    if (!session || !session.value) {
      console.warn("No session found, returning null.");
      return null;
    }

    const { databases, account } = await createSessionClient();
    const result = await account.get();

    const user = await databases.listDocuments(
      appwriteConfig.databaseId,
      appwriteConfig.userscollectionId,
      [Query.equal("accountId", result.$id)]
    );

    return user.total > 0 ? parseStringify(user.documents[0]) : null;
  } catch (error) {
    console.warn("Error fetching current user:", error);
    return null;
  }
};

export const signOutUser = async () => {
  try {
    const { account } = await createSessionClient();
    await account.deleteSession("current");

    (await cookies()).set("appwrite-session", "", {
      path: "/",
      maxAge: 0, // Ensures cookie is deleted
    });

    console.log("User logged out successfully");
  } catch (error) {
    handleError(error, "Failed to sign out user");
  } finally {
    redirect("/sign-in");
  }
};

export const signInUser = async ({ email }: { email: string }) => {
  try {
    const existingUser = await getUserByEmail(email);

    // user exists send otp
    if (existingUser) {
      await sendEmailOTP({ email });
      return parseStringify({ accountId: existingUser.accountId });
    }

    return parseStringify({ accountId: null, error: "User not found" });
  } catch (error) {
    handleError(error, "Failed to sign");
  }
};
