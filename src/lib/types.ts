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
