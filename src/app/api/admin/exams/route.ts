import type { NextRequest } from "next/server";
import { failure, success } from "@/lib/api-response";
import { isAdmin } from "@/lib/admin-auth";
import { invalidateExam } from "@/lib/data";
import { connectDB } from "@/lib/db";
import { SLUG_PATTERN, deriveSlug, toExamDocument, validateExamPayload } from "@/lib/exam-validation";
import { Exam } from "@/models/Exam";

const MAX_BODY_BYTES = 2 * 1024 * 1024;

// POST /api/admin/exams  { slug?: string, exam: { exam_info, questions } }
// Creates the exam, or replaces it if the slug already exists.
export async function POST(request: NextRequest) {
  if (!(await isAdmin())) return failure("Unauthorised.", 401);

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return failure("Payload too large (max 2 MB).", 413);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return failure("Request body is not valid JSON.", 400);
  }

  const { slug: requestedSlug, exam } = (body ?? {}) as { slug?: unknown; exam?: unknown };
  const result = validateExamPayload(exam);
  if (!result.ok) {
    return Response.json({ status: "error", code: 422, message: "Validation failed.", errors: result.errors }, { status: 422 });
  }

  const slug = typeof requestedSlug === "string" && requestedSlug.trim() ? requestedSlug.trim() : deriveSlug(result.data.exam_info);
  if (!SLUG_PATTERN.test(slug) || slug.length > 120) {
    return failure("Slug may only contain lowercase English letters, digits and single hyphens.", 422);
  }

  try {
    await connectDB();
    const write = await Exam.updateOne({ slug }, { $set: toExamDocument(slug, result.data) }, { upsert: true, runValidators: true });
    invalidateExam(slug);
    const created = write.upsertedCount === 1;
    return success(
      created ? "Exam created." : "Exam updated.",
      { slug, created, questions: result.data.questions.length, warnings: result.warnings },
      created ? 201 : 200,
    );
  } catch (err) {
    console.error("POST /api/admin/exams failed:", err);
    return failure("Failed to save exam.", 500);
  }
}
