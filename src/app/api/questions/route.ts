import { connection } from "next/server";
import { failure, success } from "@/lib/api-response";
import { getQuestionBankSummary } from "@/lib/data";

// GET /api/questions
// The mock exam's question bank (every exam, duplicates removed) as a summary: total and per-subject counts.
// The questions themselves come from /api/questions/random, so setting up an exam downloads almost nothing.
export async function GET() {
  await connection();

  try {
    const summary = await getQuestionBankSummary();
    return success(`${summary.total} question(s) available.`, summary);
  } catch (err) {
    console.error("GET /api/questions failed:", err);
    return failure("Failed to retrieve the question bank.", 500);
  }
}
