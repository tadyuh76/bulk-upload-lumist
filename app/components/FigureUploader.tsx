"use client";

import { useMemo, useState } from "react";
import {
  uploadQuestionFigure,
  type UploadedQuestionFigure,
} from "@/lib/question-media";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const MAX_CONCURRENT_UPLOADS = 3;
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type FigureStatus = "ready" | "uploading" | "uploaded" | "failed";

interface PendingFigure {
  id: string;
  file: File;
  status: FigureStatus;
  error?: string;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeCsvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function downloadCsv(figures: UploadedQuestionFigure[]) {
  const rows = [
    ["Source Filename", "Supabase Image URL", "Markdown Image", "Storage Path"],
    ...figures.map((figure) => [
      figure.filename,
      figure.url,
      figure.markdown,
      figure.objectPath,
    ]),
  ];
  const csv = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = "question-figure-links.csv";
  link.click();
  URL.revokeObjectURL(href);
}

export default function FigureUploader() {
  const [figures, setFigures] = useState<PendingFigure[]>([]);
  const [uploadedFigures, setUploadedFigures] = useState<UploadedQuestionFigure[]>(
    []
  );
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completedCount = useMemo(
    () => figures.filter((figure) => figure.status === "uploaded").length,
    [figures]
  );

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (selectedFiles.length === 0) return;

    const existingNames = new Set(figures.map((figure) => figure.file.name));
    const selectedNames = new Set<string>();
    let hasDuplicateFilename = false;
    const invalidFile = selectedFiles.find((file) => {
      const duplicate = existingNames.has(file.name) || selectedNames.has(file.name);
      hasDuplicateFilename ||= duplicate;
      selectedNames.add(file.name);
      return (
        duplicate ||
        !SUPPORTED_IMAGE_TYPES.has(file.type) ||
        file.size === 0 ||
        file.size > MAX_FILE_SIZE_BYTES
      );
    });

    if (invalidFile) {
      setError(
        hasDuplicateFilename
          ? "Each image needs a unique filename so Claude can match it correctly."
          : "Choose PNG, JPG, WEBP, GIF, or AVIF files that are 20 MB or smaller."
      );
      return;
    }

    setError(null);
    setFigures((current) => [
      ...current,
      ...selectedFiles.map((file, index) => ({
        id: `${crypto.randomUUID()}-${index}`,
        file,
        status: "ready" as const,
      })),
    ]);
  };

  const updateFigure = (id: string, changes: Partial<PendingFigure>) => {
    setFigures((current) =>
      current.map((figure) =>
        figure.id === id ? { ...figure, ...changes } : figure
      )
    );
  };

  const handleUpload = async () => {
    const queuedFigures = figures.filter((figure) => figure.status === "ready");
    if (queuedFigures.length === 0) return;

    setIsUploading(true);
    setError(null);

    let nextIndex = 0;
    const worker = async () => {
      while (nextIndex < queuedFigures.length) {
        const figure = queuedFigures[nextIndex++];
        updateFigure(figure.id, { status: "uploading", error: undefined });

        try {
          const uploadedFigure = await uploadQuestionFigure(figure.file);
          setUploadedFigures((current) => [...current, uploadedFigure]);
          updateFigure(figure.id, { status: "uploaded" });
        } catch (uploadError) {
          updateFigure(figure.id, {
            status: "failed",
            error:
              uploadError instanceof Error
                ? uploadError.message
                : "Image upload failed.",
          });
        }
      }
    };

    await Promise.all(
      Array.from(
        { length: Math.min(MAX_CONCURRENT_UPLOADS, queuedFigures.length) },
        worker
      )
    );

    setIsUploading(false);
  };

  const reset = () => {
    if (isUploading) return;
    setFigures([]);
    setUploadedFigures([]);
    setError(null);
  };

  return (
    <section className="rounded-lg border border-blue-200 bg-blue-50 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Upload figure images
          </h2>
          <p className="mt-1 text-sm text-gray-800">
            Select every figure at once. Download the CSV when it finishes, then
            give it to Claude with your question sheet.
          </p>
        </div>
        {uploadedFigures.length > 0 && (
          <button
            type="button"
            onClick={() => downloadCsv(uploadedFigures)}
            disabled={isUploading}
            className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Download links CSV
          </button>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-dashed border-blue-300 bg-white p-4">
        <label className="block text-sm font-medium text-gray-900" htmlFor="figure-images">
          Figure files
        </label>
        <input
          id="figure-images"
          type="file"
          accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFilesSelected}
          disabled={isUploading}
          className="mt-2 block w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <p className="mt-2 text-xs text-gray-700">
          PNG, JPG, WEBP, GIF, or AVIF. Up to 20 MB per image. Use unique filenames.
        </p>
      </div>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      {figures.length > 0 && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleUpload}
              disabled={isUploading || figures.every((figure) => figure.status !== "ready")}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploading ? "Uploading figures..." : "Upload figures"}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={isUploading}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Clear
            </button>
            <span className="text-sm text-gray-700">
              {completedCount} of {figures.length} uploaded
            </span>
          </div>

          <ul className="mt-4 max-h-56 divide-y divide-blue-100 overflow-y-auto rounded-lg border border-blue-100 bg-white">
            {figures.map((figure) => (
              <li
                key={figure.id}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{figure.file.name}</p>
                  <p className="text-xs text-gray-600">{formatFileSize(figure.file.size)}</p>
                </div>
                <span
                  className={
                    figure.status === "failed"
                      ? "text-red-700"
                      : figure.status === "uploaded"
                      ? "text-green-700"
                      : "text-gray-700"
                  }
                >
                  {figure.error ||
                    (figure.status === "uploaded"
                      ? "Uploaded"
                      : figure.status === "uploading"
                      ? "Uploading"
                      : "Ready")}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {uploadedFigures.length > 0 && (
        <p className="mt-4 text-xs text-gray-700">
          The CSV includes the permanent Supabase URL and a Markdown image snippet.
          Claude can place that snippet in the Question or Instruction cell.
        </p>
      )}
    </section>
  );
}
