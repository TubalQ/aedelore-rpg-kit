import { auth } from "@/lib/auth/config";
import { getSettings } from "@/lib/db/queries/app-settings";
import { redirect } from "next/navigation";
import Link from "next/link";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { countActiveUsers } from "@/lib/db/queries/users";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const session = await auth();
  if (session) redirect("/dashboard");

  if (!(await getSettings()).credentialsEnabled) {
    redirect("/login");
  }

  // The very first account bootstraps the instance as admin.
  let isFirst = false;
  try {
    isFirst = (await countActiveUsers()) === 0;
  } catch {
    // If the DB isn't reachable yet, just show the normal form.
  }

  return (
    <div className="rounded-md border border-border bg-gradient-to-b from-bg-surface/75 to-bg-base/85 p-10 text-center shadow-2xl backdrop-blur-md">
      <h1 className="font-display text-3xl font-semibold text-accent-gold">
        {isFirst ? "Set up your world" : "Create your account"}
      </h1>
      <p className="mt-2 font-display text-base italic text-text-muted">
        {isFirst
          ? "This first account becomes the administrator."
          : "Begin your story beyond the threshold."}
      </p>

      <RegisterForm />

      <p className="mt-5 text-sm text-text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-accent-gold hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
