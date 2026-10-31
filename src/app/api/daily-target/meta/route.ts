import { connection } from "next/server";
import { connectDB } from "@/lib/db";
import { failure, success } from "@/lib/api-response";
import { countQuestions, subjectInfoOf } from "@/lib/subject-validation";
import { Topic } from "@/models/Subject";
import { Exam } from "@/models/Exam";

type TopicRow = {
  slug: string;
  subject_info: { name: string; topic: string; description: string };
  questions: { question_no: number }[];
};

export type DailyTargetMetaSubject = {
  id: string; // slug or identifier
  name: string; // display title in Bengali / English
  source: "topic" | "exam";
  total_questions: number;
  topics: { name: string; total_questions: number }[];
};

// GET /api/daily-target/meta
// Returns all subjects with their available topics and question counts.
export async function GET() {
  await connection();

  try {
    await connectDB();

    // 1. Fetch from Topic (curated lecture sheets / topics)
    const topicDocs = await Topic.find({}, { _id: 0, slug: 1, subject_info: 1, "questions.question_no": 1 })
      .sort({ createdAt: 1 })
      .lean<TopicRow[]>();

    const bySlug = new Map<string, TopicRow[]>();
    for (const d of topicDocs) {
      bySlug.set(d.slug, [...(bySlug.get(d.slug) ?? []), d]);
    }

    const subjects: DailyTargetMetaSubject[] = [...bySlug].map(([slug, rows]) => {
      const info = subjectInfoOf(rows);
      const topicsList = rows.map((r) => ({
        name: r.subject_info.topic,
        total_questions: r.questions?.length ?? 0,
      }));
      const totalQuestions = countQuestions(rows.map((r) => ({ questions: r.questions })));

      return {
        id: slug,
        name: info.name,
        source: "topic",
        total_questions: totalQuestions,
        topics: topicsList,
      };
    });

    const knownSubjectNames = new Set(subjects.map((s) => s.name.trim().toLowerCase()));

    // 2. Also check Exam collection for additional subjects with questions
    try {
      const examStats = await Exam.aggregate([
        { $unwind: "$questions" },
        {
          $group: {
            _id: {
              subject: "$questions.subject",
              topic: { $ifNull: ["$questions.topic", ""] },
            },
            count: { $sum: 1 },
          },
        },
      ]);

      const examSubjectsMap = new Map<string, Map<string, number>>();
      for (const stat of examStats) {
        const subj = String(stat._id?.subject ?? "").trim();
        const top = String(stat._id?.topic ?? "").trim();
        if (!subj) continue;
        if (!examSubjectsMap.has(subj)) {
          examSubjectsMap.set(subj, new Map());
        }
        if (top) {
          examSubjectsMap.get(subj)!.set(top, (examSubjectsMap.get(subj)!.get(top) ?? 0) + (stat.count || 0));
        }
      }

      for (const [subjName, topicsMap] of examSubjectsMap.entries()) {
        if (knownSubjectNames.has(subjName.toLowerCase())) continue;

        let totalQ = 0;
        const topList: { name: string; total_questions: number }[] = [];
        for (const [tName, count] of topicsMap.entries()) {
          totalQ += count;
          topList.push({ name: tName, total_questions: count });
        }

        subjects.push({
          id: `exam-${encodeURIComponent(subjName.toLowerCase().replace(/\s+/g, "-"))}`,
          name: subjName,
          source: "exam",
          total_questions: totalQ || 50,
          topics: topList,
        });
      }
    } catch (e) {
      // If aggregate fails, topic subjects are still intact
      console.warn("Could not query Exam collection for daily-target meta:", e);
    }

    subjects.sort((a, b) => a.name.localeCompare(b.name));

    return success("Daily target metadata retrieved successfully.", {
      subjects,
    });
  } catch (err) {
    console.error("GET /api/daily-target/meta failed:", err);
    return failure("Failed to retrieve daily target metadata.", 500);
  }
}

