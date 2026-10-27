// Shapes returned by the /api/exams endpoints, shared by client components.

export type ExamInfo = {
  exam_title: string;
  organization: string;
  exam_type: string;
  exam_date: string;
  total_marks: number;
  total_questions: number;
  source_url: string;
};

export type Question = {
  question_no: number;
  subject: string;
  topic: string;
  question: string;
  options: string[];
  correct_answer: string;
  explanation: string;
};

export type ExamListItem = {
  slug: string;
  exam_info: ExamInfo;
};

export type ExamListResponse = {
  status: "success";
  code: number;
  message: string;
  pagination: { page: number; limit: number; total: number; total_pages: number };
  exams: ExamListItem[];
};

export type ExamDetailResponse = {
  status: "success";
  code: number;
  message: string;
  exam_info: ExamInfo;
  questions: Question[];
};

// ---- Subject-wise study (/api/subjects), uploaded separately from exams.

export type SubjectInfo = {
  name: string;
  description: string;
};

/** Every question in a subject file has its own topic; the topic list is built from them. */
export type SubjectQuestion = Omit<Question, "subject">;

export type TopicSummary = { name: string; total_questions: number };

export type SubjectListItem = {
  slug: string;
  subject_info: SubjectInfo;
  total_questions: number;
  topics: TopicSummary[];
};

export type SubjectListResponse = {
  status: "success";
  code: number;
  message: string;
  subjects: SubjectListItem[];
};

export type SubjectDetailResponse = {
  status: "success";
  code: number;
  message: string;
  slug: string;
  subject_info: SubjectInfo;
  topics: TopicSummary[];
  questions: SubjectQuestion[];
};
