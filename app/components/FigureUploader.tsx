"use client";

import { useState } from "react";
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

  const completedCount = figures.filter(
    (figure) => figure.status === "uploaded"
  ).length;

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
    const queuedFigures = figures.filter(
      (figure) => figure.status === "ready" || figure.status === "failed"
    );
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
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8">
      <div className="flex flex-col gap-5 border-b border-zinc-100 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-zinc-950">
            Bulk upload images
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600">
            Upload your figures, then download a CSV with their permanent Supabase links and Markdown snippets.
          </p>
        </div>
        {uploadedFigures.length > 0 && (
          <button
            type="button"
            onClick={() => downloadCsv(uploadedFigures)}
            disabled={isUploading}
            className="shrink-0 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
          >
            Download links CSV
          </button>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-5 sm:px-5">
        <label className="block text-sm font-semibold text-zinc-950" htmlFor="figure-images">
          Select figure files
        </label>
        <input
          id="figure-images"
          type="file"
          accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFilesSelected}
          disabled={isUploading}
          className="mt-3 block w-full text-sm text-zinc-600 file:mr-4 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-zinc-900 file:shadow-sm file:ring-1 file:ring-zinc-200 hover:file:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <p className="mt-3 text-xs leading-5 text-zinc-500">
          PNG, JPG, WEBP, GIF, or AVIF. Up to 20 MB per image. Use unique filenames so Claude can match them correctly.
        </p>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {error}
        </p>
      )}

      {figures.length > 0 && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleUpload}
              disabled={
                isUploading ||
                figures.every(
                  (figure) =>
                    figure.status !== "ready" && figure.status !== "failed"
                )
              }
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploading
                ? "Uploading figures..."
                : figures.some((figure) => figure.status === "ready")
                ? "Upload figures"
                : "Retry failed figures"}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={isUploading}
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Clear
            </button>
            <span className="text-sm text-zinc-500">
              {completedCount} of {figures.length} uploaded
            </span>
          </div>

          <ul className="mt-5 max-h-64 overflow-y-auto rounded-xl border border-zinc-200 bg-white">
            {figures.map((figure) => (
              <li
                key={figure.id}
                className="flex items-center justify-between gap-4 border-b border-zinc-100 px-4 py-3 last:border-b-0 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-zinc-900">{figure.file.name}</p>
                  <p className="text-xs text-zinc-500">{formatFileSize(figure.file.size)}</p>
                </div>
                <span
                  className={
                    figure.status === "failed"
                      ? "text-red-700"
                      : figure.status === "uploaded"
                      ? "text-green-700"
                      : "text-zinc-500"
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
        <p className="mt-5 text-xs leading-5 text-zinc-500">
          The CSV includes the permanent URL and ready-to-paste Markdown. Ask Claude to place the Markdown in the relevant Question or Instruction cell.
        </p>
      )}
    </section>
  );
}
