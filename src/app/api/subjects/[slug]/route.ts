import type { NextRequest } from "next/server";
import { failure, success } from "@/lib/api-response";
import { getSubject } from "@/lib/data";

// GET /api/subjects/[slug]
// Returns subject_info, the topic list and every question in the subject.
// Topic filtering happens on the client, so one cached response serves every topic offline.
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/subjects/[slug]">) {
  const { slug } = await ctx.params;

  try {
    const subject = await getSubject(slug);
    if (!subject) return failure(`Subject '${slug}' not found.`, 404);

    return success(`All ${subject.questions.length} questions retrieved successfully.`, { slug, ...subject });
  } catch (err) {
    console.error(`GET /api/subjects/${slug} failed:`, err);
    return failure("Failed to retrieve subject details.", 500);
  }
}
