import { connection, type NextRequest } from "next/server";
import { failure, success } from "@/lib/api-response";
import { getExamList } from "@/lib/data";

// Each entry is only exam_info (a few hundred bytes), so a high cap lets the app load the whole list in one request.
const MAX_LIMIT = 500;

// GET /api/exams?page=1&limit=20
// Returns exam_info for each exam (no questions) so the frontend can show a list.
export async function GET(request: NextRequest) {
  await connection();

  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.parseInt(params.get("limit") ?? "20", 10) || 20));

  try {
    const { total, exams } = await getExamList(page, limit);
    return success(`${exams.length} exam(s) retrieved successfully.`, {
      pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
      exams,
    });
  } catch (err) {
    console.error("GET /api/exams failed:", err);
    return failure("Failed to retrieve exams.", 500);
  }
}
