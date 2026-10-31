import { connection, type NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { failure, success } from "@/lib/api-response";
import { Topic } from "@/models/Subject";
import { Exam } from "@/models/Exam";
import type { PipelineStage } from "mongoose";

export type DailyTargetQuestionItem = {
  key: string;
  question_no: number;
  subject: string;
  topic: string;
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
};

// GET /api/daily-target/questions?subject=slugOrName&topic=topicName
export async function GET(request: NextRequest) {
  await connection();

  const searchParams = request.nextUrl.searchParams;
  const requestedSubject = searchParams.get("subject")?.trim();
  const requestedTopic = searchParams.get("topic")?.trim();

  if (!requestedSubject) {
    return failure("Subject parameter is required.", 400);
  }

  try {
    await connectDB();

    // 1. Search in Topic collection first
    const topicFilter: Record<string, unknown> = {
      $or: [
        { slug: requestedSubject },
        { "subject_info.name": requestedSubject },
        { "subject_info.name": new RegExp(`^${requestedSubject}$`, "i") },
      ],
    };

    if (requestedTopic) {
      topicFilter["subject_info.topic"] = requestedTopic;
    }

    const topicDocs = await Topic.find(topicFilter, {
      _id: 0,
      slug: 1,
      subject_info: 1,
      questions: 1,
    })
      .sort({ createdAt: 1 })
      .lean();

    if (topicDocs.length > 0) {
      const subjectName = topicDocs[0]?.subject_info?.name ?? requestedSubject;
      const slug = topicDocs[0]?.slug ?? requestedSubject;

      const questions: DailyTargetQuestionItem[] = [];
      let globalIndex = 1;

      for (const doc of topicDocs) {
        const topName = doc.subject_info?.topic ?? "";
        for (const q of doc.questions ?? []) {
          questions.push({
            key: `${slug}::${topName}::${q.question_no}`,
            question_no: globalIndex++,
            subject: subjectName,
            topic: topName,
            question: q.question,
            options: q.options,
            correct_answer: q.correct_answer,
            explanation: q.explanation ?? "",
          });
        }
      }

      return success(`${questions.length} question(s) retrieved from subject topics.`, {
        subject: subjectName,
        topic: requestedTopic ?? "",
        total_questions: questions.length,
        questions,
      });
    }

    // 2. If not found in Topic, search in Exam collection
    // Strip possible "exam-" prefix if used
    const cleanSubj = requestedSubject.startsWith("exam-")
      ? decodeURIComponent(requestedSubject.replace(/^exam-/, "")).replace(/-/g, " ")
      : requestedSubject;

    const matchConditions: Record<string, unknown> = {
      $or: [
        { "questions.subject": cleanSubj },
        { "questions.subject": new RegExp(cleanSubj, "i") },
      ],
    };

    if (requestedTopic) {
      matchConditions["questions.topic"] = requestedTopic;
    }

    const pipeline: PipelineStage[] = [
      { $unwind: "$questions" },
      { $match: matchConditions },
      {
        $group: {
          _id: { $toLower: "$questions.question" },
          question: { $first: "$questions" },
          slug: { $first: "$slug" },
        },
      },
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
        },
      },
      { $limit: 500 },
    ];

    const examResults = await Exam.aggregate(pipeline);

    if (examResults.length === 0) {
      return failure(`No questions found for subject "${requestedSubject}".`, 404);
    }

    const questions: DailyTargetQuestionItem[] = examResults.map((q, idx) => ({
      key: `exam::${q.slug}::${q.question_no}::${idx}`,
      question_no: idx + 1,
      subject: q.subject,
      topic: q.topic || "",
      question: q.question,
      options: q.options,
      correct_answer: q.correct_answer,
      explanation: q.explanation || "",
    }));

    return success(`${questions.length} question(s) retrieved from exams.`, {
      subject: questions[0]?.subject ?? requestedSubject,
      topic: requestedTopic ?? "",
      total_questions: questions.length,
      questions,
    });
  } catch (err) {
    console.error("GET /api/daily-target/questions failed:", err);
    return failure("Failed to retrieve questions for daily target.", 500);
  }
}
