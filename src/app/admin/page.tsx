import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { Skeleton } from "@/components/StatusViews";
import { isAdmin } from "@/lib/admin-auth";

// The session cookie is request data, so the check must sit behind Suspense
// (Cache Components). Every admin API route re-checks the session as well.
async function AdminGate() {
  if (!(await isAdmin())) redirect("/admin/login");
  return <AdminDashboard />;
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-6xl px-3 py-8 sm:px-6 lg:px-8">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="mt-8 h-96 rounded-3xl" />
        </main>
      }
    >
      <AdminGate />
    </Suspense>
  );
}
