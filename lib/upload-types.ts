export type ExamMode = "sat" | "ap" | "act";
export type QuestionType = "multiple_choice" | "numeric";
export type DifficultyLevel = "easy" | "medium" | "intense";

export interface Question {
  question_id?: string;
  reference_id: string;
  organization_id?: string;
  question_type: QuestionType;
  question_text: string;
  instructions: string;
  explanation: string;
  difficulty: DifficultyLevel;
  tag: string;
  sub_skill?: string;
  image_description?: string;
  answer_choices: string[];
  correct_answer: string;
  in_question_bank?: boolean;
}

export interface Test {
  test_id?: string;
  reference_id?: string;
  title: string;
  description?: string;
  test_date?: string;
  is_full_test?: boolean;
  is_archived?: boolean;
  is_monitored?: boolean;
  organization_id?: string;
}

export interface TestQuestion {
  test_question_id?: string;
  question_id: string;
  test_section_id: string;
  test_id: string;
  order_in_test: number;
}

export interface UploadOptions {
  organizationId?: string;
  inQuestionBank: boolean;
}

export interface ModuleData {
  moduleNumber: number;
  questions: Question[];
}
