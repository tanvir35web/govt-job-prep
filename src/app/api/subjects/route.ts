import { connection } from "next/server";
import { connectDB } from "@/lib/db";
import { failure, success } from "@/lib/api-response";
import { buildTopics, countQuestions, subjectInfoOf } from "@/lib/subject-validation";
import { Topic } from "@/models/Subject";

type TopicRow = { slug: string; subject_info: { name: string; topic: string; description: string }; questions: { question_no: number }[] };

// GET /api/subjects
// Returns every subject with its topic list and question counts (no questions).
export async function GET() {
  await connection();

  try {
    await connectDB();
    // Only question numbers are read, to count questions per topic.
    const docs = await Topic.find({}, { _id: 0, slug: 1, subject_info: 1, "questions.question_no": 1 })
      .sort({ createdAt: 1 })
      .lean<TopicRow[]>();

    // One subject per slug, its topics in upload order.
    const bySlug = new Map<string, TopicRow[]>();
    for (const d of docs) bySlug.set(d.slug, [...(bySlug.get(d.slug) ?? []), d]);

    const subjects = [...bySlug]
      .map(([slug, rows]) => {
        const topics = rows.map((r) => ({ name: r.subject_info.topic, questions: r.questions }));
        return { slug, subject_info: subjectInfoOf(rows), total_questions: countQuestions(topics), topics: buildTopics(topics) };
      })
      .sort((a, b) => a.subject_info.name.localeCompare(b.subject_info.name));

    return success(`${subjects.length} subject(s) retrieved successfully.`, { subjects });
  } catch (err) {
    console.error("GET /api/subjects failed:", err);
    return failure("Failed to retrieve subjects.", 500);
  }
}
