import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export type QuestionType = "multiple_choice" | "numeric";
export type DifficultyLevel = "easy" | "medium" | "intense";

export interface Question {
  question_id?: string;
  reference_id: string;
  question_type: QuestionType;
  question_text: string;
  instructions: string;
  explanation: string;
  difficulty: DifficultyLevel;
  tag: string;
  answer_choices: string[];
  correct_answer: string;
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
}

export interface TestSection {
  test_section_id: string;
  name: string;
  duration_minutes: number;
  is_desmos_allowed: boolean;
  is_math_section?: boolean;
}

export interface TestQuestion {
  test_question_id?: string;
  question_id: string;
  test_section_id: string;
  test_id: string;
  order_in_test: number;
}
