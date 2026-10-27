import type { NextRequest } from "next/server";
import { failure, success } from "@/lib/api-response";
import { isAdmin } from "@/lib/admin-auth";
import { connectDB } from "@/lib/db";
import { SLUG_PATTERN } from "@/lib/exam-validation";
import { countQuestions, validateSubjectPayload } from "@/lib/subject-validation";
import { Topic } from "@/models/Subject";

// A subject file holds a whole question bank, so it is allowed to be larger than an exam.
const MAX_BODY_BYTES = 5 * 1024 * 1024;

// POST /api/admin/subjects  { slug: string, subject: { subject_info, questions } | [...], mode?: "merge" | "replace", remove_topics?: string[] }
// Each topic is one document, keyed by slug + topic. For an existing subject:
//   merge (default)  each topic in the upload replaces that topic; other topics stay.
//                    remove_topics are deleted too: editing a topic and renaming it must not leave the old one behind.
//   replace          the subject becomes exactly the upload.
// Replaced topics keep their place in the list (it is ordered by first upload); new ones go at the end.
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
    const { subject_info: info, topics } = result.data;
    const uploadedTopics = topics.map((t) => t.name);
    const created = !(await Topic.exists({ slug }));

    if (mode === "replace") await Topic.deleteMany({ slug, "subject_info.topic": { $nin: uploadedTopics } });
    else if (removeTopics.length > 0) {
      await Topic.deleteMany({ slug, "subject_info.topic": { $in: removeTopics.filter((t) => !uploadedTopics.includes(t)) } });
    }

    await Topic.bulkWrite(
      topics.map((t) => ({
        updateOne: {
          filter: { slug, "subject_info.topic": t.name },
          update: {
            $set: {
              slug,
              "subject_info.name": info.name,
              "subject_info.topic": t.name,
              // A topic uploaded without a description keeps the one it had.
              ...(info.description ? { "subject_info.description": info.description } : {}),
              questions: t.questions,
            },
          },
          upsert: true,
        },
      })),
    );
    // The subject's name comes from the latest upload, on every topic.
    await Topic.updateMany({ slug }, { $set: { "subject_info.name": info.name } });

    const saved = await Topic.find({ slug }, { _id: 0, "questions.question_no": 1 }).lean<{ questions: unknown[] }[]>();
    return success(
      created ? "Subject created." : "Subject updated.",
      { slug, created, uploaded: countQuestions(topics), questions: countQuestions(saved), warnings: result.warnings },
      created ? 201 : 200,
    );
  } catch (err) {
    console.error("POST /api/admin/subjects failed:", err);
    return failure("Failed to save subject.", 500);
  }
}
