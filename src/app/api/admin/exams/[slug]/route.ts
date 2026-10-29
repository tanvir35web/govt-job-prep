import type { NextRequest } from "next/server";
import { failure, success } from "@/lib/api-response";
import { isAdmin } from "@/lib/admin-auth";
import { connectDB } from "@/lib/db";
import { toExamDocument, validateExamPayload } from "@/lib/exam-validation";
import { Exam } from "@/models/Exam";

const MAX_BODY_BYTES = 256 * 1024;

// GET /api/admin/exams/[slug]
// The exam as stored, in the upload format, for editing in the admin panel. Never cached by the
// service worker (it skips /api/admin), so an edit always starts from the latest data.
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/admin/exams/[slug]">) {
  if (!(await isAdmin())) return failure("Unauthorised.", 401);
  const { slug } = await ctx.params;

  try {
    await connectDB();
    const exam = await Exam.findOne({ slug }, { _id: 0, exam_info: 1, questions: 1 }).lean();
    if (!exam) return failure(`Exam '${slug}' not found.`, 404);
    const questions = [...exam.questions].sort((a, b) => a.question_no - b.question_no);
    return success("Exam retrieved.", { slug, exam: { exam_info: exam.exam_info, questions } });
  } catch (err) {
    console.error(`GET /api/admin/exams/${slug} failed:`, err);
    return failure("Failed to retrieve exam.", 500);
  }
}

// PATCH /api/admin/exams/[slug]  { question_no: number, question: { subject, topic, question, options, correct_answer, explanation } }
// Replaces one question, keeping its number. The whole exam is re-validated, so the saved exam stays as valid as an upload.
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/admin/exams/[slug]">) {
  if (!(await isAdmin())) return failure("Unauthorised.", 401);
  const { slug } = await ctx.params;

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return failure("Payload too large (max 256 KB).", 413);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return failure("Request body is not valid JSON.", 400);
  }

  const { question_no: questionNo, question } = (body ?? {}) as { question_no?: unknown; question?: unknown };
  if (typeof questionNo !== "number" || typeof question !== "object" || question === null || Array.isArray(question)) {
    return failure("Send question_no and a question object.", 400);
  }

  try {
    await connectDB();
    const exam = await Exam.findOne({ slug }, { _id: 0, exam_info: 1, questions: 1 }).lean();
    if (!exam) return failure(`Exam '${slug}' not found.`, 404);

    const index = exam.questions.findIndex((q) => q.question_no === questionNo);
    if (index === -1) return failure(`Question ${questionNo} not found in '${slug}'.`, 404);

    const questions: unknown[] = [...exam.questions];
    questions[index] = { ...question, question_no: questionNo };
    const result = validateExamPayload({ exam_info: exam.exam_info, questions });
    if (!result.ok) {
      return Response.json({ status: "error", code: 422, message: "Validation failed.", errors: result.errors }, { status: 422 });
    }

    await Exam.updateOne({ slug }, { $set: toExamDocument(slug, result.data) }, { runValidators: true });
    const saved = result.data.questions.find((q) => q.question_no === questionNo);
    return success("Question updated.", { slug, question: saved });
  } catch (err) {
    console.error(`PATCH /api/admin/exams/${slug} failed:`, err);
    return failure("Failed to save question.", 500);
  }
}

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
