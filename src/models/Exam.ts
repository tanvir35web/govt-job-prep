import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const QuestionSchema = new Schema(
  {
    question_no: { type: Number, required: true },
    subject: { type: String, required: true },
    topic: { type: String, default: "" },
    question: { type: String, required: true },
    options: { type: [String], required: true },
    correct_answer: { type: String, required: true },
    explanation: { type: String, default: "" },
  },
  { _id: false },
);

const ExamInfoSchema = new Schema(
  {
    exam_title: { type: String, required: true },
    organization: { type: String, required: true },
    exam_type: { type: String, required: true },
    exam_date: { type: String, required: true }, // display format, e.g. "15 October, 2026"
    total_marks: { type: Number, required: true },
    total_questions: { type: Number, required: true },
    source_url: { type: String, default: "" },
  },
  { _id: false },
);

const ExamSchema = new Schema(
  {
    // URL-safe identifier used by GET /api/exams/[slug]
    slug: { type: String, required: true, unique: true, index: true },
    exam_info: { type: ExamInfoSchema, required: true },
    // Parsed from exam_info.exam_date; used only for sorting the list
    exam_date_sort: { type: Date, index: true },
    questions: { type: [QuestionSchema], default: [] },
  },
  { timestamps: true, collection: "exams" },
);

export type ExamDoc = InferSchemaType<typeof ExamSchema>;

export const Exam: Model<ExamDoc> =
  (mongoose.models.Exam as Model<ExamDoc> | undefined) ?? mongoose.model<ExamDoc>("Exam", ExamSchema);
