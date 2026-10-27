import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

// One document per subject, uploaded from the admin panel separately from exams.
// Topics are not stored on their own; the API builds the topic list from the questions.

const SubjectQuestionSchema = new Schema(
  {
    question_no: { type: Number, required: true },
    topic: { type: String, required: true },
    question: { type: String, required: true },
    options: { type: [String], required: true },
    correct_answer: { type: String, required: true },
    explanation: { type: String, default: "" },
  },
  { _id: false },
);

const SubjectInfoSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
  },
  { _id: false },
);

const SubjectSchema = new Schema(
  {
    // URL-safe identifier used by GET /api/subjects/[slug]
    slug: { type: String, required: true, unique: true, index: true },
    subject_info: { type: SubjectInfoSchema, required: true },
    questions: { type: [SubjectQuestionSchema], default: [] },
  },
  { timestamps: true, collection: "subjects" },
);

export type SubjectDoc = InferSchemaType<typeof SubjectSchema>;

export const Subject: Model<SubjectDoc> =
  (mongoose.models.Subject as Model<SubjectDoc> | undefined) ?? mongoose.model<SubjectDoc>("Subject", SubjectSchema);
