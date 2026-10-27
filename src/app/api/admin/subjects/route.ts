import type { NextRequest } from "next/server";
import { failure, success } from "@/lib/api-response";
import { isAdmin } from "@/lib/admin-auth";
import { connectDB } from "@/lib/db";
import { SLUG_PATTERN } from "@/lib/exam-validation";
import { mergeSubjectQuestions, validateSubjectPayload } from "@/lib/subject-validation";
import { Subject } from "@/models/Subject";

// A subject file holds a whole question bank, so it is allowed to be larger than an exam.
const MAX_BODY_BYTES = 5 * 1024 * 1024;

// POST /api/admin/subjects  { slug: string, subject: { subject_info, questions }, mode?: "merge" | "replace", remove_topics?: string[] }
// Creates the subject if the slug is new. For an existing subject:
//   merge (default)  each topic in the upload replaces that topic; other topics stay. Lecture sheets are
//                    uploaded one at a time, so the subject's first description is kept.
//                    remove_topics are dropped first: editing a topic and renaming it must not leave the old one behind.
//   replace          the subject becomes exactly the upload.
export async function POST(request: NextRequest) {
  if (!(await isAdmin())) return failure("Unauthorised.", 401);

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return failure("Payload too large (max 5 MB).", 413);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return failure("Request body is not valid JSON.", 400);
  }

  const { slug: requestedSlug, subject, mode, remove_topics: removeTopics = [] } = (body ?? {}) as {
    slug?: unknown;
    subject?: unknown;
    mode?: unknown;
    remove_topics?: unknown;
  };
  if (mode !== undefined && mode !== "merge" && mode !== "replace") return failure('mode must be "merge" or "replace".', 422);
  if (!Array.isArray(removeTopics) || !removeTopics.every((t) => typeof t === "string")) return failure("remove_topics must be a list of topic names.", 422);
  const result = validateSubjectPayload(subject);
  if (!result.ok) {
    return Response.json({ status: "error", code: 422, message: "Validation failed.", errors: result.errors }, { status: 422 });
  }

  const slug = typeof requestedSlug === "string" ? requestedSlug.trim() : "";
  if (!SLUG_PATTERN.test(slug) || slug.length > 120) {
    return failure("Slug may only contain lowercase English letters, digits and single hyphens.", 422);
  }

  try {
    await connectDB();
    const existing = mode === "replace" ? null : await Subject.findOne({ slug }, { _id: 0, subject_info: 1, questions: 1 }).lean();
    const data = existing
      ? {
          subject_info: { name: result.data.subject_info.name, description: existing.subject_info.description || result.data.subject_info.description },
          questions: mergeSubjectQuestions(
            existing.questions.filter((q) => !removeTopics.includes(q.topic)),
            result.data.questions,
          ),
        }
      : result.data;

    const write = await Subject.updateOne({ slug }, { $set: { slug, ...data } }, { upsert: true, runValidators: true });
    const created = write.upsertedCount === 1;
    return success(
      created ? "Subject created." : "Subject updated.",
      { slug, created, uploaded: result.data.questions.length, questions: data.questions.length, warnings: result.warnings },
      created ? 201 : 200,
    );
  } catch (err) {
    console.error("POST /api/admin/subjects failed:", err);
    return failure("Failed to save subject.", 500);
  }
}
