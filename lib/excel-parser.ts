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

        // Validate that we have data
        if (jsonData.length === 0) {
          reject(
            new Error(
              "The Excel file is empty or has no data rows. Please ensure your file contains data."
            )
          );
          return;
        }

        // Helper function to normalize column names (will be defined below)
        const normalizeKey = (key: string): string => {
          return key.toLowerCase().replace(/[_\s]/g, "");
        };

        // Validate required headers exist
        const headers = Object.keys(jsonData[0] || {});
        const normalizedHeaders = headers.map((h) => normalizeKey(h));
        const requiredHeaders = [
          "questionid",
          "referenceid",
          "question_id",
          "reference_id",
        ];
        const hasRequiredHeader = requiredHeaders.some((req) =>
          normalizedHeaders.includes(normalizeKey(req))
        );

        if (!hasRequiredHeader) {
          const detectedHeaders = headers.join('", "');
          reject(
            new Error(
              `Missing required column 'question_id' or 'reference_id'.\n\nDetected columns: "${detectedHeaders}"\n\nPlease ensure your Excel file has a column named 'question_id', 'Question_ID', 'Question ID', 'reference_id', 'Reference_ID', or 'Reference ID'.`
            )
          );
          return;
        }

        // Helper function to preserve linebreaks while trimming only leading/trailing whitespace
        const trimPreserveLinebreaks = (str: string): string => {
          return str.replace(/^[\t ]+|[\t ]+$/gm, "");
        };

        // Helper function to convert \frac to \dfrac in LaTeX
        const convertFracToDisplayFrac = (str: string): string => {
          return str.replace(/\\frac/g, "\\dfrac");
        };

        // Helper function to get value with fallback headers (case-insensitive, space/underscore flexible)
        const getValue = (
          row: Record<string, string>,
          primary: string,
          fallbacks: string[] = []
        ): string => {
          // Create a normalized key map for flexible lookup
          const normalizedRow: Record<string, string> = {};
          Object.keys(row).forEach((key) => {
            normalizedRow[normalizeKey(key)] = row[key];
          });

          // Check primary key (normalized)
          if (normalizedRow[normalizeKey(primary)])
            return normalizedRow[normalizeKey(primary)];

          // Check fallback keys (normalized)
          for (const fallback of fallbacks) {
            if (normalizedRow[normalizeKey(fallback)])
              return normalizedRow[normalizeKey(fallback)];
          }
          return "";
        };

        // Parse rows using header names
        const questions: ParsedQuestion[] = [];
        let skippedRows = 0;

        for (const row of jsonData) {
          const questionId = getValue(row, "question_id", [
            "reference_id",
            "question id",
            "reference id",
          ]);

          // Skip empty rows
          if (!questionId || String(questionId).trim() === "") {
            skippedRows++;
            continue;
          }

          questions.push({
            reference_id: String(questionId).trim(),
            tag: String(
              getValue(row, "tag", ["sat_tag", "sat tag", "category"]) || ""
            ).trim(),
            difficulty: String(getValue(row, "difficulty") || "medium")
              .toLowerCase()
              .trim()
              .replace("hard", "intense"),
            instructions: convertFracToDisplayFrac(
              trimPreserveLinebreaks(
                String(
                  getValue(row, "instructions", ["instruction", "passage"]) ||
                    ""
                )
              )
            ),
            question_text: convertFracToDisplayFrac(
              trimPreserveLinebreaks(
                String(
                  getValue(row, "question_text", [
                    "question",
                    "question text",
                  ]) || ""
                )
              )
            ),
            answer_a: convertFracToDisplayFrac(
              trimPreserveLinebreaks(
                String(
                  getValue(row, "answer_a", [
                    "option_a",
                    "option_1",
                    "answer a",
                    "option a",
                    "option 1",
                  ]) || ""
                )
              )
            ),
            answer_b: convertFracToDisplayFrac(
              trimPreserveLinebreaks(
                String(
                  getValue(row, "answer_b", [
                    "option_b",
                    "option_2",
                    "answer b",
                    "option b",
                    "option 2",
                  ]) || ""
                )
              )
            ),
            answer_c: convertFracToDisplayFrac(
              trimPreserveLinebreaks(
                String(
                  getValue(row, "answer_c", [
                    "option_c",
                    "option_3",
                    "answer c",
                    "option c",
                    "option 3",
                  ]) || ""
                )
              )
            ),
            answer_d: convertFracToDisplayFrac(
              trimPreserveLinebreaks(
                String(
                  getValue(row, "answer_d", [
                    "option_d",
                    "option_4",
                    "answer d",
                    "option d",
                    "option 4",
                  ]) || ""
                )
              )
            ),
            correct_answer: String(
              getValue(row, "correct_answer", ["correct answer"]) || ""
            )
              .trim()
              .toUpperCase(),
            explanation: convertFracToDisplayFrac(
              trimPreserveLinebreaks(
                String(getValue(row, "explanation", ["solution"]) || "")
              )
            ),
          });
        }

        // Log warning if rows were skipped
        if (skippedRows > 0) {
          console.warn(
            `Skipped ${skippedRows} row(s) without a valid question_id/reference_id`
          );
        }

        // Validate that we parsed at least one question
        if (questions.length === 0) {
          const detectedHeaders = headers.join('", "');
          reject(
            new Error(
              `No valid questions found in the Excel file. ${
                skippedRows > 0
                  ? `${skippedRows} row(s) were skipped because they had no question_id/reference_id value.`
                  : ""
              }\n\nDetected columns: "${detectedHeaders}"\n\nPlease ensure:\n1. Your column headers match the expected format (e.g., 'question_id', 'Question_ID', or 'Question ID')\n2. Your data rows contain values in the question_id/reference_id column`
            )
          );
          return;
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
      : answerMap[parsed.correct_answer] || "1",
  };
}

export function convertParsedQuestions(
  parsedQuestions: ParsedQuestion[]
): Question[] {
  return parsedQuestions.map(convertToQuestion);
}
