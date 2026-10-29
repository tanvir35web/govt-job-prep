import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import { type BankQuestion, type BankSummary, buildBank, summarise } from "./bank";
import { connectDB } from "./db";
import { buildTopics, countQuestions, flattenTopics, subjectInfoOf } from "./subject-validation";
import type { ExamInfo, ExamListItem, Question, SubjectListItem } from "./types";
import { Exam } from "@/models/Exam";
import { Topic } from "@/models/Subject";

// Cached reads behind the public API. Content changes only through the admin panel, which invalidates the
// matching tags after every write (invalidate* below), so a change shows on the next request.
// The "days" lifetime is a safety net for changes made outside the panel, such as the scripts/ folder.
// Entries live in the server's memory: a cold serverless instance starts empty and fills as it is used.

const tags = {
  exams: "exams",
  questions: "questions",
  exam: (slug: string) => `exam:${slug}`,
  subjects: "subjects",
  subject: (slug: string) => `subject:${slug}`,
};

// Expire immediately rather than serve stale content once, so an admin sees the change straight away.
const NOW = { expire: 0 };

/** After an exam is created, replaced or deleted: its detail, the list and the mock exam's question bank. */
export function invalidateExam(slug: string) {
  revalidateTag(tags.exam(slug), NOW);
  revalidateTag(tags.exams, NOW);
  revalidateTag(tags.questions, NOW);
}

/** After a single question changes: the list shows no question text, so only the detail and the question bank. */
export function invalidateExamQuestions(slug: string) {
  revalidateTag(tags.exam(slug), NOW);
  revalidateTag(tags.questions, NOW);
}

/** After any change to a subject or its topics: its detail and the list (which carries topic counts). */
export function invalidateSubject(slug: string) {
  revalidateTag(tags.subject(slug), NOW);
  revalidateTag(tags.subjects, NOW);
}

export async function getExamList(page: number, limit: number): Promise<{ total: number; exams: ExamListItem[] }> {
  "use cache";
  cacheLife("days");
  cacheTag(tags.exams);

  await connectDB();
  const [total, exams] = await Promise.all([
    Exam.countDocuments(),
    Exam.find({}, { _id: 0, slug: 1, exam_info: 1 })
      .sort({ exam_date_sort: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<ExamListItem[]>(),
  ]);
  return { total, exams };
}

/** null when there is no such exam. Questions are stored sorted by number (validateExamPayload sorts them). */
export async function getExam(slug: string): Promise<{ exam_info: ExamInfo; questions: Question[] } | null> {
  "use cache";
  cacheLife("days");
  cacheTag(tags.exam(slug));

  await connectDB();
  const exam = await Exam.findOne({ slug }, { _id: 0, exam_info: 1, questions: 1 }).lean<{ exam_info: ExamInfo; questions: Question[] }>();
  if (!exam) return null;
  // Older documents may predate sorting on upload, so sort here too; it is cheap and cached.
  return { exam_info: exam.exam_info, questions: [...exam.questions].sort((a, b) => a.question_no - b.question_no) };
}

/** Every exam's questions with duplicates removed, for the mock exam. Kept on the server; clients get a summary and random draws. */
export async function getQuestionBank(): Promise<BankQuestion[]> {
  "use cache";
  cacheLife("days");
  cacheTag(tags.questions);

  await connectDB();
  const exams = await Exam.find({}, { _id: 0, slug: 1, "exam_info.exam_title": 1, questions: 1 })
    .sort({ exam_date_sort: -1, _id: -1 })
    .lean<{ slug: string; exam_info: { exam_title: string }; questions: Question[] }[]>();
  return buildBank(exams.map((e) => ({ slug: e.slug, title: e.exam_info.exam_title, questions: e.questions })));
}

export async function getQuestionBankSummary(): Promise<BankSummary> {
  "use cache";
  cacheLife("days");
  cacheTag(tags.questions);

  return summarise(await getQuestionBank());
}

type TopicRow ={ slug: string; subject_info: { name: string; topic: string; description: string }; questions: { question_no: number }[] };

export async function getSubjectList(): Promise<SubjectListItem[]> {
  "use cache";
  cacheLife("days");
  cacheTag(tags.subjects);

  await connectDB();
  // Only question numbers are read, to count questions per topic.
  const docs = await Topic.find({}, { _id: 0, slug: 1, subject_info: 1, "questions.question_no": 1 })
    .sort({ createdAt: 1 })
    .lean<TopicRow[]>();

  // One subject per slug, its topics in upload order.
  const bySlug = new Map<string, TopicRow[]>();
  for (const d of docs) bySlug.set(d.slug, [...(bySlug.get(d.slug) ?? []), d]);

  return [...bySlug]
    .map(([slug, rows]) => {
      const topics = rows.map((r) => ({ name: r.subject_info.topic, questions: r.questions }));
      return { slug, subject_info: subjectInfoOf(rows), total_questions: countQuestions(topics), topics: buildTopics(topics) };
    })
    .sort((a, b) => a.subject_info.name.localeCompare(b.subject_info.name));
}

/** null when there is no such subject. */
export async function getSubject(slug: string) {
  "use cache";
  cacheLife("days");
  cacheTag(tags.subject(slug));

  await connectDB();
  const docs = await Topic.find({ slug }, { _id: 0, subject_info: 1, questions: 1 }).sort({ createdAt: 1 }).lean();
  if (docs.length === 0) return null;

  // Stored one document per topic; the response keeps one flat list with each question's topic beside it.
  const topics = docs.map((d) => ({ name: d.subject_info.topic, questions: d.questions }));
  return { subject_info: subjectInfoOf(docs), topics: buildTopics(topics), questions: flattenTopics(topics) };
}
