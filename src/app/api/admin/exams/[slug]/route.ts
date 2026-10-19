import type { NextRequest } from "next/server";
import { failure, success } from "@/lib/api-response";
import { isAdmin } from "@/lib/admin-auth";
import { connectDB } from "@/lib/db";
import { Exam } from "@/models/Exam";

// DELETE /api/admin/exams/[slug]
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/admin/exams/[slug]">) {
  if (!(await isAdmin())) return failure("Unauthorised.", 401);
  const { slug } = await ctx.params;

  try {
    await connectDB();
    const { deletedCount } = await Exam.deleteOne({ slug });
    if (deletedCount === 0) return failure(`Exam '${slug}' not found.`, 404);
    return success("Exam deleted.", { slug });
  } catch (err) {
    console.error(`DELETE /api/admin/exams/${slug} failed:`, err);
    return failure("Failed to delete exam.", 500);
  }
}
