import { cookies } from "next/headers";
import { success } from "@/lib/api-response";
import { ADMIN_COOKIE } from "@/lib/admin-auth";

// POST /api/admin/logout
export async function POST() {
  (await cookies()).delete(ADMIN_COOKIE);
  return success("Logged out.", {});
}
