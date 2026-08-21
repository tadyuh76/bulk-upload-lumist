import type {
  ExamMode,
  ModuleData,
  UploadOptions,
} from "./upload-types";

export interface UploadProgress {
  stage: "questions" | "test" | "test_questions" | "complete";
  current: number;
  total: number;
  message: string;
}

export type { ModuleData } from "./upload-types";

export async function uploadBulkData(
  modules: ModuleData[],
  testTitle: string,
  testDescription: string,
  examMode: ExamMode,
  options: UploadOptions,
  onProgress?: (progress: UploadProgress) => void
): Promise<{ test_id: string; total_questions: number }> {
  const totalQuestions = modules.reduce(
    (total, module) => total + module.questions.length,
    0
  );

  onProgress?.({
    stage: "questions",
    current: 0,
    total: totalQuestions,
    message: "Uploading questions...",
  });

  const response = await fetch("/api/bulk-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      modules,
      testTitle,
      testDescription,
      examMode,
      options,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { test_id: string; total_questions: number }
    | { error?: string }
    | null;

  if (!response.ok || !payload || !("test_id" in payload)) {
    throw new Error(
      payload && "error" in payload && payload.error
        ? payload.error
        : "Upload failed. Please try again."
    );
  }

  onProgress?.({
    stage: "complete",
    current: payload.total_questions,
    total: payload.total_questions,
    message: "Upload complete!",
  });

  return payload;
}
