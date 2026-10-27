import { connection } from "next/server";
import { connectDB } from "@/lib/db";
import { failure, success } from "@/lib/api-response";
import { buildTopics } from "@/lib/subject-validation";
import type { SubjectInfo } from "@/lib/types";
import { Subject } from "@/models/Subject";

// GET /api/subjects
// Returns every subject with its topic list and question counts (no questions).
export async function GET() {
  await connection();

  try {
    await connectDB();
    // Only each question's topic is read, to count questions per topic.
    const docs = await Subject.find({}, { _id: 0, slug: 1, subject_info: 1, "questions.topic": 1 })
      .sort({ "subject_info.name": 1 })
      .lean<{ slug: string; subject_info: SubjectInfo; questions: { topic: string }[] }[]>();

    const subjects = docs.map((s) => ({
      slug: s.slug,
      subject_info: s.subject_info,
      total_questions: s.questions.length,
      topics: buildTopics(s.questions),
    }));

    return success(`${subjects.length} subject(s) retrieved successfully.`, { subjects });
  } catch (err) {
    console.error("GET /api/subjects failed:", err);
    return failure("Failed to retrieve subjects.", 500);
  }
}
