import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { failure, success } from "@/lib/api-response";
import { Exam } from "@/models/Exam";

// GET /api/exams/[slug]
// Returns exam_info plus every question for the selected exam.
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/exams/[slug]">) {
  const { slug } = await ctx.params;

  try {
    await connectDB();
    const exam = await Exam.findOne({ slug }, { _id: 0, exam_info: 1, questions: 1 }).lean();

    if (!exam) {
      return failure(`Exam '${slug}' not found.`, 404);
    }

    const questions = [...exam.questions].sort((a, b) => a.question_no - b.question_no);

    return success(`All ${questions.length} questions retrieved successfully for educational purposes.`, {
      exam_info: exam.exam_info,
      questions,
    });
  } catch (err) {
    console.error(`GET /api/exams/${slug} failed:`, err);
    return failure("Failed to retrieve exam details.", 500);
  }
}
