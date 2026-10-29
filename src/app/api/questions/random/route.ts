import { connection, type NextRequest } from "next/server";
import { failure, success } from "@/lib/api-response";
import { MAX_DRAW, draw } from "@/lib/bank";
import { getQuestionBank } from "@/lib/data";

// GET /api/questions/random?count=20&subject=বাংলা&subject=গণিত
// count random questions (1–100) from the given subjects, or from all when none is given. Never cached: each call is a new draw.
export async function GET(request: NextRequest) {
  await connection();

  const params = request.nextUrl.searchParams;
  const count = Number(params.get("count"));
  if (!Number.isInteger(count) || count < 1 || count > MAX_DRAW) return failure(`count must be a whole number from 1 to ${MAX_DRAW}.`, 400);
  const subjects = params.getAll("subject").filter(Boolean);

  try {
    const questions = draw(await getQuestionBank(), count, subjects);
    const res = success(`${questions.length} question(s) drawn.`, { questions });
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (err) {
    console.error("GET /api/questions/random failed:", err);
    return failure("Failed to draw questions.", 500);
  }
}
