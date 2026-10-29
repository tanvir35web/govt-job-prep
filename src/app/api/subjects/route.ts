import { connection } from "next/server";
import { failure, success } from "@/lib/api-response";
import { getSubjectList } from "@/lib/data";

// GET /api/subjects
// Returns every subject with its topic list and question counts (no questions).
export async function GET() {
  await connection();

  try {
    const subjects = await getSubjectList();
    return success(`${subjects.length} subject(s) retrieved successfully.`, { subjects });
  } catch (err) {
    console.error("GET /api/subjects failed:", err);
    return failure("Failed to retrieve subjects.", 500);
  }
}
