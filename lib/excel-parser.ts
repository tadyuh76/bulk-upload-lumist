import * as XLSX from "xlsx";
import type { Question } from "./supabase";

export interface ParsedQuestion {
  reference_id: string;
  tag: string;
  difficulty: string;
  instructions: string;
  question_text: string;
  answer_a: string;
  answer_b: string;
  answer_c: string;
  answer_d: string;
  correct_answer: string;
  explanation: string;
}

export async function parseExcelFile(file: File): Promise<ParsedQuestion[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON with headers
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          defval: "",
        }) as Record<string, string>[];

        // Helper function to preserve linebreaks while trimming only leading/trailing whitespace
        const trimPreserveLinebreaks = (str: string): string => {
          return str.replace(/^[\t ]+|[\t ]+$/gm, "");
        };

        // Helper function to convert \frac to \dfrac in LaTeX
        const convertFracToDisplayFrac = (str: string): string => {
          return str.replace(/\\frac/g, "\\dfrac");
        };

        // Helper function to get value with fallback headers (case-insensitive)
        const getValue = (
          row: Record<string, string>,
          primary: string,
          fallbacks: string[] = []
        ): string => {
          // Create a lowercase key map for case-insensitive lookup
          const lowerRow: Record<string, string> = {};
          Object.keys(row).forEach((key) => {
            lowerRow[key.toLowerCase()] = row[key];
          });

          // Check primary key (lowercase)
          if (lowerRow[primary.toLowerCase()])
            return lowerRow[primary.toLowerCase()];

          // Check fallback keys (lowercase)
          for (const fallback of fallbacks) {
            if (lowerRow[fallback.toLowerCase()])
              return lowerRow[fallback.toLowerCase()];
          }
          return "";
        };

        // Parse rows using header names
        const questions: ParsedQuestion[] = [];

        for (const row of jsonData) {
          const questionId = getValue(row, "question_id", ["reference_id"]);

          // Skip empty rows
          if (!questionId || String(questionId).trim() === "") continue;

          questions.push({
            reference_id: String(questionId).trim(),
            tag: String(getValue(row, "tag") || "").trim(),
            difficulty: String(getValue(row, "difficulty") || "medium")
              .toLowerCase()
              .trim()
              .replace("hard", "intense"),
            instructions: convertFracToDisplayFrac(
              trimPreserveLinebreaks(
                String(getValue(row, "instructions", ["instruction"]) || "")
              )
            ),
            question_text: convertFracToDisplayFrac(
              trimPreserveLinebreaks(
                String(getValue(row, "question_text", ["question"]) || "")
              )
            ),
            answer_a: convertFracToDisplayFrac(
              trimPreserveLinebreaks(
                String(getValue(row, "answer_a", ["option_a", "option_1"]) || "")
              )
            ),
            answer_b: convertFracToDisplayFrac(
              trimPreserveLinebreaks(
                String(getValue(row, "answer_b", ["option_b", "option_2"]) || "")
              )
            ),
            answer_c: convertFracToDisplayFrac(
              trimPreserveLinebreaks(
                String(getValue(row, "answer_c", ["option_c", "option_3"]) || "")
              )
            ),
            answer_d: convertFracToDisplayFrac(
              trimPreserveLinebreaks(
                String(getValue(row, "answer_d", ["option_d", "option_4"]) || "")
              )
            ),
            correct_answer: String(getValue(row, "correct_answer") || "")
              .trim()
              .toUpperCase(),
            explanation: convertFracToDisplayFrac(
              trimPreserveLinebreaks(
                String(getValue(row, "explanation", ["solution"]) || "")
              )
            ),
          });
        }

        resolve(questions);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

export function convertToQuestion(parsed: ParsedQuestion): Question {
  // Convert letter (A, B, C, D) to index (1, 2, 3, 4)
  const answerMap: { [key: string]: string } = {
    A: "1",
    B: "2",
    C: "3",
    D: "4",
  };

  const answerChoices = [
    parsed.answer_a,
    parsed.answer_b,
    parsed.answer_c,
    parsed.answer_d,
  ].filter((choice) => choice !== "");

  // Detect numeric questions: no answer choices provided
  const isNumeric = answerChoices.length === 0;

  return {
    reference_id: parsed.reference_id,
    question_type: isNumeric ? "numeric" : "multiple_choice",
    question_text: parsed.question_text,
    instructions: parsed.instructions,
    explanation: parsed.explanation,
    difficulty: parsed.difficulty as "easy" | "medium" | "intense",
    tag: parsed.tag,
    answer_choices: answerChoices,
    correct_answer: isNumeric
      ? parsed.correct_answer
      : (answerMap[parsed.correct_answer] || "1"),
  };
}

export function convertParsedQuestions(
  parsedQuestions: ParsedQuestion[]
): Question[] {
  return parsedQuestions.map(convertToQuestion);
}
