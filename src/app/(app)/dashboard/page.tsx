import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { DashboardContent } from "./dashboard-content";

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return <DashboardContent userName={session.user?.name || undefined} />;
}
