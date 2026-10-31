import { connection, type NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { failure, success } from "@/lib/api-response";
import { Exam } from "@/models/Exam";
import type { PipelineStage } from "mongoose";

// GET /api/mock-exam
// Query Params:
//   - marks | count | limit: number of questions to pick (10–100)
//   - subjects | subject: comma-separated or multiple subject names (e.g. "বাংলা,English")
//
// When marks/count is omitted: returns metadata (available subjects with question counts and total questions).
// When marks/count is provided: returns a randomized set of questions sampled directly from the database.
export async function GET(request: NextRequest) {
  await connection();

  const params = request.nextUrl.searchParams;
  const rawCount = params.get("marks") ?? params.get("count") ?? params.get("limit");

  try {
    await connectDB();

    // Mode 1: Metadata for the exam setup view
    if (!rawCount) {
      const stats = await Exam.aggregate([
        { $unwind: "$questions" },
        {
          $group: {
            _id: { $toLower: "$questions.question" },
            subject: { $first: "$questions.subject" },
          },
        },
        {
          $group: {
            _id: "$subject",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]);

      const subjects = stats
        .filter((s) => typeof s._id === "string" && s._id.trim() !== "")
        .map((s) => ({ name: s._id as string, count: s.count as number }));

      const total_questions = subjects.reduce((sum, s) => sum + s.count, 0);

      return success("Mock exam metadata retrieved successfully.", {
        total_questions,
        subjects,
      });
    }

    // Mode 2: Generating random questions for an exam
    const count = Math.min(100, Math.max(1, Number.parseInt(rawCount, 10) || 20));

    const subjectsParam = params.get("subjects") ?? params.get("subject");
    let subjectsList: string[] = [];
    if (subjectsParam) {
      subjectsList = subjectsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      const allSubjects = params.getAll("subject");
      if (allSubjects.length > 0) {
        subjectsList = allSubjects.map((s) => s.trim()).filter(Boolean);
      }
    }

    const matchStage: Record<string, unknown> = {};
    if (subjectsList.length > 0) {
      matchStage["questions.subject"] = { $in: subjectsList };
    }

    const pipeline: PipelineStage[] = [
      { $unwind: "$questions" },
      ...(subjectsList.length > 0 ? [{ $match: matchStage }] : []),
      {
        $group: {
          _id: { $toLower: "$questions.question" },
          question: { $first: "$questions" },
          slug: { $first: "$slug" },
          examTitle: { $first: "$exam_info.exam_title" },
        },
      },
      { $sample: { size: count } },
      {
        $project: {
          _id: 0,
          question_no: "$question.question_no",
          subject: "$question.subject",
          topic: "$question.topic",
          question: "$question.question",
          options: "$question.options",
          correct_answer: "$question.correct_answer",
          explanation: "$question.explanation",
          slug: "$slug",
          examTitle: "$examTitle",
        },
      },
    ];

    const results = await Exam.aggregate(pipeline);

    const questions = results.map((q) => ({
      ...q,
      key: `${q.slug}#${q.question_no}`,
    }));

    return success(`${questions.length} question(s) retrieved successfully for mock exam.`, {
      config: {
        count,
        subjects: subjectsList,
      },
      total_available: questions.length,
      questions,
    });
  } catch (err) {
    console.error("GET /api/mock-exam failed:", err);
    return failure("Failed to process mock exam request.", 500);
  }
}

