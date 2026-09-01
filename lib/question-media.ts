export interface UploadedQuestionFigure {
  filename: string;
  objectPath: string;
  url: string;
  markdown: string;
}

export async function uploadQuestionFigure(
  file: File
): Promise<UploadedQuestionFigure> {
  const formData = new FormData();
  formData.set("file", file);

  const response = await fetch("/api/question-media", {
    method: "POST",
    body: formData,
  });

  const payload = (await response.json().catch(() => null)) as
    | UploadedQuestionFigure
    | { error?: string }
    | null;

  if (!response.ok || !payload || !("url" in payload)) {
    throw new Error(
      payload && "error" in payload && payload.error
        ? payload.error
        : "Image upload failed. Please try again."
    );
  }

  return payload;
}
