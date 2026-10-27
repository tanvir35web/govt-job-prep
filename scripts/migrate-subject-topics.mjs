// One-off migration: copies every subject from the old `subjects` collection (one document per subject,
// a topic on every question) into `subject_topics`, one document per topic in the upload format:
//   { slug, subject_info: { name, topic, description }, questions: [{ question_no, question, options, correct_answer, explanation }] }
// Dry run by default; it only prints what would be written. Pass --apply to write.
//
//   node --env-file=.env scripts/migrate-subject-topics.mjs
//   node --env-file=.env scripts/migrate-subject-topics.mjs --apply
//
// The old collection is only read, never changed, so the site keeps working until the new code is deployed.
// Safe to run again: each topic is written by slug + topic, replacing what an earlier run wrote.
// Drop `subjects` by hand once the new version is live and checked.
import mongoose from "mongoose";

const apply = process.argv.includes("--apply");

if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI is not set. Run with --env-file=.env (see .env.example).");
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const oldSubjects = db.collection("subjects");
const topicsCollection = db.collection("subject_topics");

try {
  const docs = await oldSubjects.find({}).toArray();
  let written = 0;

  for (const doc of docs) {
    if (!Array.isArray(doc.questions)) {
      console.warn(`${doc.slug}: has no questions list; skipped.`);
      continue;
    }

    // Topics in first-seen order, questions by number within each, as the old upload stored them.
    const topics = [];
    for (const q of doc.questions) {
      const name = String(q.topic ?? "").trim().replace(/\s+/g, " ");
      let topic = topics.find((t) => t.name === name);
      if (!topic) topics.push((topic = { name, questions: [] }));
      topic.questions.push({
        question_no: q.question_no,
        question: q.question,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation ?? "",
      });
    }

    console.log(`${doc.slug}: ${doc.questions.length} question(s) -> ${topics.length} topic(s): ${topics.map((t) => `${t.name} (${t.questions.length})`).join(", ")}`);
    if (!apply) continue;

    // The topic list is ordered by createdAt, so the old order is kept by spacing them a millisecond apart.
    const base = (doc.createdAt instanceof Date ? doc.createdAt : new Date()).getTime();
    const now = new Date();
    for (const [i, topic] of topics.entries()) {
      topic.questions.sort((a, b) => a.question_no - b.question_no);
      await topicsCollection.updateOne(
        { slug: doc.slug, "subject_info.topic": topic.name },
        {
          $set: {
            slug: doc.slug,
            subject_info: { name: doc.subject_info?.name ?? doc.slug, topic: topic.name, description: doc.subject_info?.description ?? "" },
            questions: topic.questions,
            createdAt: new Date(base + i),
            updatedAt: now,
          },
        },
        { upsert: true },
      );
      written++;
    }
  }

  console.log(
    apply
      ? `Wrote ${written} topic document(s) from ${docs.length} subject(s).`
      : `Dry run: ${docs.length} subject(s) found. Run again with --apply to write.`,
  );
} finally {
  await mongoose.disconnect();
}
