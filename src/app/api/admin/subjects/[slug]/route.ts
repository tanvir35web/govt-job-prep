import type { NextRequest } from "next/server";
import { failure, success } from "@/lib/api-response";
import { isAdmin } from "@/lib/admin-auth";
import { invalidateSubject } from "@/lib/data";
import { connectDB } from "@/lib/db";
import type { TopicFile } from "@/lib/subject-validation";
import { Topic } from "@/models/Subject";

// GET /api/admin/subjects/[slug]
// The subject's topic documents as stored, in the upload format, for editing in the admin panel. Never
// cached by the service worker (it skips /api/admin), so an edit always starts from the latest data.
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/admin/subjects/[slug]">) {
  if (!(await isAdmin())) return failure("Unauthorised.", 401);
  const { slug } = await ctx.params;

  try {
    await connectDB();
    const docs = await Topic.find({ slug }, { _id: 0, subject_info: 1, questions: 1 }).sort({ createdAt: 1 }).lean();
    if (docs.length === 0) return failure(`Subject '${slug}' not found.`, 404);
    const files: TopicFile[] = docs.map(({ subject_info: { name, topic, description }, questions }) => ({
      // An empty description is left out, so it doesn't clutter the JSON.
      subject_info: { name, topic, ...(description ? { description } : {}) },
      questions,
    }));
    return success("Subject retrieved.", { slug, files });
  } catch (err) {
    console.error(`GET /api/admin/subjects/${slug} failed:`, err);
    return failure("Failed to retrieve subject.", 500);
  }
}

// DELETE /api/admin/subjects/[slug]               deletes the subject (every topic)
// DELETE /api/admin/subjects/[slug]?topic=<name>  deletes one topic (lecture sheet); the subject is gone once its last topic is
export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/admin/subjects/[slug]">) {
  if (!(await isAdmin())) return failure("Unauthorised.", 401);
  const { slug } = await ctx.params;
  const topic = request.nextUrl.searchParams.get("topic");

  try {
    await connectDB();

    if (topic === null) {
      const { deletedCount } = await Topic.deleteMany({ slug });
      if (deletedCount === 0) return failure(`Subject '${slug}' not found.`, 404);
      invalidateSubject(slug);
      return success("Subject deleted.", { slug });
    }

    const target = await Topic.findOneAndDelete({ slug, "subject_info.topic": topic }, { projection: { "questions.question_no": 1 } }).lean<{
      questions: unknown[];
    }>();
    if (!target) return failure(`Topic '${topic}' not found in '${slug}'.`, 404);
    const removed = target.questions.length;
    invalidateSubject(slug);

    const subjectDeleted = !(await Topic.exists({ slug }));
    return success(
      subjectDeleted ? "Topic deleted; it was the last one, so the subject was deleted too." : "Topic deleted.",
      { slug, topic, removed, subjectDeleted },
    );
  } catch (err) {
    console.error(`DELETE /api/admin/subjects/${slug} failed:`, err);
    return failure("Failed to delete.", 500);
  }
}
