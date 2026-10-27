import type { NextRequest } from "next/server";
import { failure, success } from "@/lib/api-response";
import { isAdmin } from "@/lib/admin-auth";
import { connectDB } from "@/lib/db";
import { Subject } from "@/models/Subject";

// GET /api/admin/subjects/[slug]
// The subject as stored, for editing in the admin panel. Same shape as the public endpoint, but never
// cached by the service worker (it skips /api/admin), so an edit always starts from the latest data.
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/admin/subjects/[slug]">) {
  if (!(await isAdmin())) return failure("Unauthorised.", 401);
  const { slug } = await ctx.params;

  try {
    await connectDB();
    const subject = await Subject.findOne({ slug }, { _id: 0, subject_info: 1, questions: 1 }).lean();
    if (!subject) return failure(`Subject '${slug}' not found.`, 404);
    return success("Subject retrieved.", { slug, subject_info: subject.subject_info, questions: subject.questions });
  } catch (err) {
    console.error(`GET /api/admin/subjects/${slug} failed:`, err);
    return failure("Failed to retrieve subject.", 500);
  }
}

// DELETE /api/admin/subjects/[slug]               deletes the subject
// DELETE /api/admin/subjects/[slug]?topic=<name>  deletes one topic (lecture sheet); the subject goes too if it was the last one
export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/admin/subjects/[slug]">) {
  if (!(await isAdmin())) return failure("Unauthorised.", 401);
  const { slug } = await ctx.params;
  const topic = request.nextUrl.searchParams.get("topic");

  try {
    await connectDB();

    if (topic === null) {
      const { deletedCount } = await Subject.deleteOne({ slug });
      if (deletedCount === 0) return failure(`Subject '${slug}' not found.`, 404);
      return success("Subject deleted.", { slug });
    }

    const subject = await Subject.findOne({ slug }, { _id: 0, "questions.topic": 1 }).lean<{ questions: { topic: string }[] }>();
    if (!subject) return failure(`Subject '${slug}' not found.`, 404);
    const removed = subject.questions.filter((q) => q.topic === topic).length;
    if (removed === 0) return failure(`Topic '${topic}' not found in '${slug}'.`, 404);

    // A subject with no topics would show up empty on the Study page, so it is removed with its last topic.
    if (removed === subject.questions.length) {
      await Subject.deleteOne({ slug });
      return success("Topic deleted; it was the last one, so the subject was deleted too.", { slug, topic, removed, subjectDeleted: true });
    }

    await Subject.updateOne({ slug }, { $pull: { questions: { topic } } });
    return success("Topic deleted.", { slug, topic, removed, subjectDeleted: false });
  } catch (err) {
    console.error(`DELETE /api/admin/subjects/${slug} failed:`, err);
    return failure("Failed to delete.", 500);
  }
}
