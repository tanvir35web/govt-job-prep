import type { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { failure, success } from "@/lib/api-response";
import { buildTopics } from "@/lib/subject-validation";
import { Subject } from "@/models/Subject";

// GET /api/subjects/[slug]
// Returns subject_info, the topic list and every question in the subject.
// Topic filtering happens on the client, so one cached response serves every topic offline.
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/subjects/[slug]">) {
  const { slug } = await ctx.params;

  try {
    await connectDB();
    const subject = await Subject.findOne({ slug }, { _id: 0, subject_info: 1, questions: 1 }).lean();

    if (!subject) {
      return failure(`Subject '${slug}' not found.`, 404);
    }

    // Stored grouped by topic, numbers ascending within each; numbers restart in every topic.
    const questions = subject.questions;

    return success(`All ${questions.length} questions retrieved successfully.`, {
      slug,
      subject_info: subject.subject_info,
      topics: buildTopics(questions),
      questions,
    });
  } catch (err) {
    console.error(`GET /api/subjects/${slug} failed:`, err);
    return failure("Failed to retrieve subject details.", 500);
  }
}
