import * as XLSX from "xlsx";
import type { Question } from "./supabase";

export interface ParsedQuestion {
  reference_id: string;
  organization_id: string;
  in_question_bank?: boolean;
  tag: string;
  sub_skill: string;
  difficulty: string;
  instructions: string;
  question_text: string;
  image_description: string;
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
        }) as Record<string, unknown>[];

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
          row: Record<string, unknown>,
          primary: string,
          fallbacks: string[] = []
        ): unknown => {
          // Create a normalized key map for flexible lookup
          const normalizedRow: Record<string, unknown> = {};
          Object.keys(row).forEach((key) => {
            normalizedRow[normalizeKey(key)] = row[key];
          });

          const hasValue = (value: unknown) =>
            value !== undefined && value !== null && String(value).trim() !== "";

          // Check primary key (normalized)
          if (hasValue(normalizedRow[normalizeKey(primary)]))
            return normalizedRow[normalizeKey(primary)];

          // Check fallback keys (normalized)
          for (const fallback of fallbacks) {
            if (hasValue(normalizedRow[normalizeKey(fallback)]))
              return normalizedRow[normalizeKey(fallback)];
          }
          return "";
        };

        const parseOptionalBoolean = (
          value: unknown,
          questionId: string
        ): boolean | undefined => {
          const normalized = String(value ?? "").trim().toLowerCase();
          if (!normalized) return undefined;
          if (["true", "yes", "1"].includes(normalized)) return true;
          if (["false", "no", "0"].includes(normalized)) return false;

          throw new Error(
            `Invalid in_question_bank value for "${questionId}". Use true or false.`
          );
        };

        // Parse rows using header names
        const questions: ParsedQuestion[] = [];
        let skippedRows = 0;

        for (const row of jsonData) {
          const questionId = getValue(row, "question_id", [
            "reference_id",
            "question id",
            "reference id",
            "questionid",
            "referenceid",
            "id",
            "q_id",
            "qid",
            "ref_id",
            "refid",
          ]);

          // Skip empty rows
          if (!questionId || String(questionId).trim() === "") {
            skippedRows++;
            continue;
          }

          questions.push({
            reference_id: String(questionId).trim(),
            organization_id: String(
              getValue(row, "organization_id", [
                "organization id",
                "organization",
                "org_id",
                "org id",
              ]) || ""
            ).trim(),
            in_question_bank: parseOptionalBoolean(
              getValue(row, "in_question_bank", [
                "in question bank",
                "question bank",
              ]),
              String(questionId).trim()
            ),
            tag: String(
              getValue(row, "tag", [
                "sat_tag",
                "sat tag",
                "category",
                "tags",
                "subject",
                "topic",
                "type",
                "sat tag",
                "cattag",
              ]) || ""
            ).trim(),
            sub_skill: String(
              getValue(row, "sub_skill", [
                "sub skill",
                "subskill",
              ]) || ""
            ).trim(),
            difficulty: String(
              getValue(row, "difficulty", [
                "level",
                "diff",
                "difficulty level",
                "question difficulty",
              ]) || "medium"
            )
              .toLowerCase()
              .trim()
              .replace("hard", "intense"),
            instructions: convertFracToDisplayFrac(
              trimPreserveLinebreaks(
                String(
                  getValue(row, "instructions", [
                    "instruction",
                    "passage",
                    "instruction text",
                    "directions",
                    "prompt",
                    "context",
                  ]) || ""
                )
              )
            ),
            question_text: convertFracToDisplayFrac(
              trimPreserveLinebreaks(
                String(
                  getValue(row, "question_text", [
                    "question",
                    "question text",
                    "questiontext",
                    "q_text",
                    "qtext",
                    "query",
                    "problem",
                  ]) || ""
                )
              )
            ),
            image_description: trimPreserveLinebreaks(
              String(
                getValue(row, "image_description", [
                  "image description",
                  "image alt",
                  "image alt text",
                  "alt text",
                ]) || ""
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
                    "choice_a",
                    "choice a",
                    "choice 1",
                    "a",
                    "ans_a",
                    "ans a",
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
                    "choice_b",
                    "choice b",
                    "choice 2",
                    "b",
                    "ans_b",
                    "ans b",
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
                    "choice_c",
                    "choice c",
                    "choice 3",
                    "c",
                    "ans_c",
                    "ans c",
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
                    "choice_d",
                    "choice d",
                    "choice 4",
                    "d",
                    "ans_d",
                    "ans d",
                  ]) || ""
                )
              )
            ),
            correct_answer: String(
              getValue(row, "correct_answer", [
                "correct answer",
                "correctanswer",
                "answer",
                "correct",
                "right_answer",
                "right answer",
                "key",
                "answer_key",
                "answer key",
              ]) || ""
            )
              .trim()
              .toUpperCase(),
            explanation: convertFracToDisplayFrac(
              trimPreserveLinebreaks(
                String(
                  getValue(row, "explanation", [
                    "solution",
                    "explanation text",
                    "rationale",
                    "reasoning",
                    "justification",
                    "answer_explanation",
                    "answer explanation",
                  ]) || ""
                )
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
    organization_id: parsed.organization_id || undefined,
    in_question_bank: parsed.in_question_bank,
    question_type: isNumeric ? "numeric" : "multiple_choice",
    question_text: parsed.question_text,
    instructions: parsed.instructions,
    explanation: parsed.explanation,
    difficulty: parsed.difficulty as "easy" | "medium" | "intense",
    tag: parsed.tag,
    sub_skill: parsed.sub_skill || undefined,
    image_description: parsed.image_description || undefined,
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
