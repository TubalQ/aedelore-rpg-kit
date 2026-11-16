import { auth } from "@/lib/auth/config";
import { bearerAuth, type BearerSession } from "@/lib/auth/bearer";
import type { Session } from "next-auth";

export async function apiAuth(): Promise<Session | BearerSession | null> {
  const session = await auth();
  if (session && typeof session === "object" && "user" in session && session.user?.id) {
    return session as Session;
  }
  return bearerAuth();
}
