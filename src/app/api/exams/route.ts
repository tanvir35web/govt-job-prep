import { connection, type NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { failure, success } from "@/lib/api-response";
import { Exam } from "@/models/Exam";

const MAX_LIMIT = 100;

// GET /api/exams?page=1&limit=20
// Returns exam_info for each exam (no questions) so the frontend can show a list.
export async function GET(request: NextRequest) {
  await connection();

  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(params.get("limit") ?? "20", 10) || 20));

  try {
    await connectDB();
    const [total, exams] = await Promise.all([
      Exam.countDocuments(),
      Exam.find({}, { _id: 0, slug: 1, exam_info: 1 })
        .sort({ exam_date_sort: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return success(`${exams.length} exam(s) retrieved successfully.`, {
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
      exams,
    });
  } catch (err) {
    console.error("GET /api/exams failed:", err);
    return failure("Failed to retrieve exams.", 500);
  }
}
