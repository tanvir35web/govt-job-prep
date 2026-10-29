import type { NextRequest } from "next/server";
import { failure, success } from "@/lib/api-response";
import { getExam } from "@/lib/data";

// GET /api/exams/[slug]
// Returns exam_info plus every question for the selected exam.
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/exams/[slug]">) {
  const { slug } = await ctx.params;

  try {
    const exam = await getExam(slug);
    if (!exam) return failure(`Exam '${slug}' not found.`, 404);

    return success(`All ${exam.questions.length} questions retrieved successfully for educational purposes.`, exam);
  } catch (err) {
    console.error(`GET /api/exams/${slug} failed:`, err);
    return failure("Failed to retrieve exam details.", 500);
  }
}
