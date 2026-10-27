import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { failure, success } from "@/lib/api-response";
import { buildTopics, flattenTopics, subjectInfoOf } from "@/lib/subject-validation";
import { Topic } from "@/models/Subject";

// GET /api/subjects/[slug]
// Returns subject_info, the topic list and every question in the subject.
// Topic filtering happens on the client, so one cached response serves every topic offline.
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/subjects/[slug]">) {
  const { slug } = await ctx.params;

  try {
    await connectDB();
    const docs = await Topic.find({ slug }, { _id: 0, subject_info: 1, questions: 1 }).sort({ createdAt: 1 }).lean();

    if (docs.length === 0) {
      return failure(`Subject '${slug}' not found.`, 404);
    }

    // Stored one document per topic; the response keeps one flat list with each question's topic beside it.
    const topics = docs.map((d) => ({ name: d.subject_info.topic, questions: d.questions }));
    const questions = flattenTopics(topics);

    return success(`All ${questions.length} questions retrieved successfully.`, {
      slug,
      subject_info: subjectInfoOf(docs),
      topics: buildTopics(topics),
      questions,
    });
  } catch (err) {
    console.error(`GET /api/subjects/${slug} failed:`, err);
    return failure("Failed to retrieve subject details.", 500);
  }
}
