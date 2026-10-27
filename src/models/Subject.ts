import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

// One document per topic (lecture sheet), in the same shape as the upload JSON, uploaded from the
// admin panel separately from exams. A subject is every document with the same slug; its topics
// are listed in the order they were first uploaded.

const SubjectQuestionSchema = new Schema(
  {
    question_no: { type: Number, required: true },
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
    topic: { type: String, required: true },
    description: { type: String, default: "" },
  },
  { _id: false },
);

const TopicSchema = new Schema(
  {
    // URL-safe identifier of the subject, shared by all its topics; used by GET /api/subjects/[slug]
    slug: { type: String, required: true, index: true },
    subject_info: { type: SubjectInfoSchema, required: true },
    questions: { type: [SubjectQuestionSchema], default: [] },
  },
  { timestamps: true, collection: "subject_topics" },
);

TopicSchema.index({ slug: 1, "subject_info.topic": 1 }, { unique: true });

export type TopicDoc = InferSchemaType<typeof TopicSchema>;

export const Topic: Model<TopicDoc> =
  (mongoose.models.Topic as Model<TopicDoc> | undefined) ?? mongoose.model<TopicDoc>("Topic", TopicSchema);
