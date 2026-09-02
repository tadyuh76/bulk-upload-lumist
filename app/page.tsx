"use client";

import { useEffect, useState } from "react";
import { parseExcelFile, convertParsedQuestions } from "@/lib/excel-parser";
import {
  uploadBulkData,
  type ModuleData,
  type UploadProgress,
} from "@/lib/database";
import type { ExamMode, Question } from "@/lib/upload-types";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import MarkdownRenderer from "@/app/components/MarkdownRenderer";
import FigureUploader from "@/app/components/FigureUploader";

const EXAM_MODES: { value: ExamMode; label: string }[] = [
  { value: "sat", label: "SAT" },
  { value: "ap", label: "AP" },
  { value: "act", label: "ACT" },
];

type WorkspaceTab = "images" | "questions";
const WORKSPACE_TABS: WorkspaceTab[] = ["images", "questions"];

interface FileWithModule {
  id: string;
  file: File;
  moduleNumber: number;
  questionCount: number;
  questions: Question[];
}

interface OrganizationOption {
  id: string;
  name: string;
}

type OrganizationLoadState = "idle" | "loading" | "ready" | "error";

function SettingsSwitch({
  id,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-start justify-between gap-4 py-4 first:pt-0 last:pb-0 ${
        disabled ? "cursor-not-allowed opacity-60" : ""
      }`}
    >
      <span>
        <span className="block text-sm font-semibold text-zinc-900">
          {label}
        </span>
        <span className="mt-1 block text-xs leading-5 text-zinc-500">
          {description}
        </span>
      </span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-zinc-200 transition after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:bg-blue-600 peer-checked:after:translate-x-5 peer-focus-visible:ring-4 peer-focus-visible:ring-blue-100 peer-disabled:opacity-60"
      />
    </label>
  );
}

function SortableFileItem({
  file,
  onRemove,
}: {
  file: FileWithModule;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: file.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm"
    >
      <div
        className="flex flex-1 items-center gap-4"
        {...attributes}
        {...listeners}
      >
        <span className="cursor-grab select-none text-xs font-medium text-zinc-400">
          Drag
        </span>
        <div className="flex-1">
          <div className="font-semibold text-zinc-900">
            Module {file.moduleNumber}
          </div>
          <div className="text-sm text-zinc-600">{file.file.name}</div>
          <div className="text-xs text-zinc-500">
            {file.questionCount} questions
          </div>
        </div>
      </div>
      <button
        onClick={onRemove}
        className="rounded-lg px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 active:translate-y-px"
      >
        Remove
      </button>
    </div>
  );
}

export default function Home() {
  const [examMode, setExamMode] = useState<ExamMode>("sat");
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("images");
  const [files, setFiles] = useState<FileWithModule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(
    null
  );
  const [testTitle, setTestTitle] = useState("");
  const [testDescription, setTestDescription] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [organizationLoadState, setOrganizationLoadState] =
    useState<OrganizationLoadState>("idle");
  const [organizationError, setOrganizationError] = useState<string | null>(
    null
  );
  const [inQuestionBank, setInQuestionBank] = useState(false);
  const [isPremium, setIsPremium] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    test_id: string;
    total_questions: number;
    examMode: ExamMode;
  } | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(
    null
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (activeTab !== "questions" || organizationLoadState !== "idle") {
      return;
    }

    let cancelled = false;

    const loadOrganizations = async () => {
      setOrganizationLoadState("loading");
      setOrganizationError(null);

      try {
        const response = await fetch("/api/organizations");
        const payload = (await response.json()) as {
          organizations?: OrganizationOption[];
        };

        if (!response.ok || !Array.isArray(payload.organizations)) {
          throw new Error("Unable to load organizations.");
        }

        if (!cancelled) {
          setOrganizations(payload.organizations);
          setOrganizationLoadState("ready");
        }
      } catch {
        if (!cancelled) {
          setOrganizationError("Unable to load organizations.");
          setOrganizationLoadState("error");
        }
      }
    };

    void loadOrganizations();

    return () => {
      cancelled = true;
    };
  }, [activeTab, organizationLoadState]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles) return;

    setIsLoading(true);
    setError(null);

    try {
      const newFiles: FileWithModule[] = [];

      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        const parsedQuestions = await parseExcelFile(file);
        const questions = convertParsedQuestions(parsedQuestions);

        // Validate that file contains questions
        if (questions.length === 0) {
          throw new Error(
            `File "${file.name}" contains no valid questions. Please verify the column headers match the expected format (e.g., 'question_id', 'Question_ID', or 'Question ID').`
          );
        }

        newFiles.push({
          id: `${Date.now()}-${i}`,
          file,
          moduleNumber: files.length + i + 1,
          questionCount: questions.length,
          questions,
        });
      }

      setFiles([...files, ...newFiles]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to parse Excel files"
      );
    } finally {
      setIsLoading(false);
      e.target.value = "";
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setFiles((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const reordered = arrayMove(items, oldIndex, newIndex);

        return reordered.map((item, index) => ({
          ...item,
          moduleNumber: index + 1,
        }));
      });
    }
  };

  const handleRemove = (id: string) => {
    const newFiles = files
      .filter((f) => f.id !== id)
      .map((item, index) => ({
        ...item,
        moduleNumber: index + 1,
      }));
    setFiles(newFiles);
  };

  const handlePreview = () => {
    setIsPreviewing(!isPreviewing);
  };

  const handleExamModeChange = (mode: ExamMode) => {
    setExamMode(mode);
    setError(null);
    setSuccess(null);
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    event.preventDefault();
    const currentIndex = WORKSPACE_TABS.indexOf(activeTab);
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextTab =
      WORKSPACE_TABS[
        (currentIndex + direction + WORKSPACE_TABS.length) %
          WORKSPACE_TABS.length
      ];

    setActiveTab(nextTab);
    document.getElementById(`${nextTab}-tab`)?.focus();
  };

  const handleUpload = async () => {
    if (!testTitle.trim()) {
      setError("Please enter a test title");
      return;
    }

    if (files.length === 0) {
      setError("Please upload at least one file");
      return;
    }

    // Validate that files contain questions
    const totalQuestions = files.reduce(
      (sum, file) => sum + file.questionCount,
      0
    );
    if (totalQuestions === 0) {
      setError(
        "Cannot upload: No questions found in any uploaded files. Please check your Excel file format and ensure question_id/reference_id column exists with valid data."
      );
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const modules: ModuleData[] = files.map((f) => ({
        moduleNumber: f.moduleNumber,
        questions: f.questions,
      }));

      const result = await uploadBulkData(
        modules,
        testTitle,
        testDescription,
        examMode,
        {
          organizationId: organizationId.trim() || undefined,
          inQuestionBank,
          isPremium,
        },
        (progress) => setUploadProgress(progress)
      );

      setSuccess({ ...result, examMode });
      setFiles([]);
      setTestTitle("");
      setTestDescription("");
      setOrganizationId("");
      setInQuestionBank(false);
      setIsPremium(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-zinc-50 px-4 py-6 text-zinc-950 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 max-w-2xl sm:mb-10">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
            Import workspace
          </h1>
          <p className="mt-3 text-base leading-7 text-zinc-600">
            Upload figures first, then use their links while preparing your question sheet.
          </p>
        </header>

        <div
          className="mb-6 grid w-full max-w-md grid-cols-2 rounded-xl border border-zinc-200 bg-white p-1 shadow-sm"
          role="tablist"
          aria-label="Import task"
        >
          <button
            id="images-tab"
            type="button"
            role="tab"
            aria-controls="images-panel"
            aria-selected={activeTab === "images"}
            onClick={() => setActiveTab("images")}
            onKeyDown={handleTabKeyDown}
            className={`rounded-lg px-2.5 py-2.5 text-xs font-semibold leading-4 transition active:translate-y-px sm:px-5 sm:text-sm sm:leading-5 ${
              activeTab === "images"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
            }`}
          >
            Bulk upload images
          </button>
          <button
            id="questions-tab"
            type="button"
            role="tab"
            aria-controls="questions-panel"
            aria-selected={activeTab === "questions"}
            onClick={() => setActiveTab("questions")}
            onKeyDown={handleTabKeyDown}
            className={`rounded-lg px-2.5 py-2.5 text-xs font-semibold leading-4 transition active:translate-y-px sm:px-5 sm:text-sm sm:leading-5 ${
              activeTab === "questions"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
            }`}
          >
            Bulk import questions
          </button>
        </div>

        <div
          id="images-panel"
          role="tabpanel"
          aria-labelledby="images-tab"
          hidden={activeTab !== "images"}
        >
          <FigureUploader />
        </div>

        <section
          id="questions-panel"
          role="tabpanel"
          aria-labelledby="questions-tab"
          hidden={activeTab !== "questions"}
          className="mx-auto max-w-5xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8"
        >
          <div className="mb-8 border-b border-zinc-100 pb-6">
            <h2 className="text-xl font-semibold tracking-tight text-zinc-950">
              Bulk import questions
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Add up to four module files, review the parsed questions, then create the test.
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-sm font-medium text-emerald-800">
                Successfully uploaded to {success.examMode.toUpperCase()}!
                Test ID:{" "}
                <span className="font-mono font-semibold">
                  {success.test_id}
                </span>{" "}
                with {success.total_questions} questions
              </p>
            </div>
          )}

          <div className="space-y-7">
            <div className="grid gap-7 border-b border-zinc-100 pb-7 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="space-y-6">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-900">
                    Upload mode *
                  </label>
                  <div
                    className="inline-grid grid-cols-3 rounded-xl border border-zinc-200 bg-zinc-50 p-1"
                    role="group"
                    aria-label="Choose upload mode"
                  >
                    {EXAM_MODES.map((mode) => {
                      const isSelected = examMode === mode.value;

                      return (
                        <button
                          key={mode.value}
                          type="button"
                          onClick={() => handleExamModeChange(mode.value)}
                          disabled={isUploading}
                          aria-pressed={isSelected}
                          className={`min-w-20 rounded-lg px-4 py-2.5 text-sm font-semibold transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-24 ${
                            isSelected
                              ? "bg-blue-600 text-white shadow-sm"
                              : "text-zinc-600 hover:bg-white hover:text-zinc-950"
                          }`}
                        >
                          {mode.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="test-title"
                      className="mb-2 block text-sm font-semibold text-zinc-900"
                    >
                      Test title *
                    </label>
                    <input
                      id="test-title"
                      type="text"
                      value={testTitle}
                      onChange={(e) => setTestTitle(e.target.value)}
                      placeholder="e.g., Practice test 1"
                      className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      disabled={isUploading}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="test-description"
                      className="mb-2 block text-sm font-semibold text-zinc-900"
                    >
                      Test description
                    </label>
                    <textarea
                      id="test-description"
                      value={testDescription}
                      onChange={(e) => setTestDescription(e.target.value)}
                      placeholder="Optional context for this test"
                      rows={2}
                      className="w-full resize-none rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      disabled={isUploading}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <div className="mb-2 flex items-baseline justify-between gap-3">
                      <label
                        htmlFor="organization-id"
                        className="block text-sm font-semibold text-zinc-900"
                      >
                        Organization
                      </label>
                      {organizationLoadState === "loading" && (
                        <span className="text-xs text-zinc-500">Loading...</span>
                      )}
                    </div>
                    <select
                      id="organization-id"
                      value={organizationId}
                      onChange={(event) => setOrganizationId(event.target.value)}
                      disabled={
                        isUploading || organizationLoadState === "loading"
                      }
                      className="w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-zinc-950 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500"
                    >
                      <option value="">No organization</option>
                      {organizations.map((organization) => (
                        <option key={organization.id} value={organization.id}>
                          {organization.name} ({organization.id})
                        </option>
                      ))}
                    </select>
                    {organizationLoadState === "error" ? (
                      <div className="mt-2 flex items-center gap-3">
                        <p className="text-xs leading-5 text-red-700">
                          {organizationError}
                        </p>
                        <button
                          type="button"
                          onClick={() => setOrganizationLoadState("idle")}
                          className="text-xs font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-800"
                        >
                          Retry
                        </button>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs leading-5 text-zinc-500">
                        Applied to the test and to questions without an
                        organization_id value in the spreadsheet.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <aside className="self-start rounded-xl border border-zinc-200 bg-zinc-50 px-4">
                <div className="border-b border-zinc-200 py-4">
                  <h3 className="text-sm font-semibold text-zinc-900">
                    Question defaults
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-zinc-500">
                    Spreadsheet values can override these per question.
                  </p>
                </div>
                <div className="divide-y divide-zinc-200">
                  <SettingsSwitch
                    id="in-question-bank"
                    label="Question bank"
                    description="Make imported questions visible in the question bank."
                    checked={inQuestionBank}
                    disabled={isUploading}
                    onChange={setInQuestionBank}
                  />
                  <SettingsSwitch
                    id="is-premium"
                    label="Premium"
                    description="Mark imported questions as premium content."
                    checked={isPremium}
                    disabled={isUploading}
                    onChange={setIsPremium}
                  />
                </div>
              </aside>
            </div>

            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-5 sm:px-5">
              <label className="mb-2 block text-sm font-semibold text-zinc-900">
                Module files
              </label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                multiple
                onChange={handleFileUpload}
                disabled={isLoading || isUploading || files.length >= 4}
                className="block w-full text-sm text-zinc-600 file:mr-4 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-zinc-900 file:shadow-sm file:ring-1 file:ring-zinc-200 hover:file:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p className="mt-3 text-xs leading-5 text-zinc-500">
                Excel or CSV. Add up to four files, one for each module. {files.length}/4 selected.
              </p>
            </div>

            {isLoading && (
              <div className="rounded-xl bg-zinc-50 px-4 py-3">
                <p className="text-sm font-medium text-zinc-700">Processing files...</p>
              </div>
            )}

            {files.length > 0 && (
              <div>
                <h2 className="mb-1 text-lg font-semibold text-zinc-950">
                  Module order
                </h2>
                <p className="mb-4 text-sm text-zinc-600">
                  Drag files into the order they should appear in the test.
                </p>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={files.map((f) => f.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {files.map((file) => (
                        <SortableFileItem
                          key={file.id}
                          file={file}
                          onRemove={() => handleRemove(file.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            )}

            {files.length > 0 && (
              <div>
                <button
                  onClick={handlePreview}
                  className="rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isUploading}
                >
                  {isPreviewing ? "Hide Preview" : "Show Preview"}
                </button>
              </div>
            )}

            {isUploading && uploadProgress && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                <p className="mb-2 text-sm font-semibold text-blue-900">
                  {uploadProgress.message}
                </p>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-blue-200">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        (uploadProgress.current / uploadProgress.total) * 100
                      }%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-xs font-medium text-blue-700">
                  {uploadProgress.current} / {uploadProgress.total}
                </p>
              </div>
            )}

            {isPreviewing && files.length > 0 && (
              <div className="border-t border-zinc-100 pt-8">
                <h2 className="mb-4 text-lg font-semibold text-zinc-950">
                  Data Preview
                </h2>
                {files.map((file) => (
                  <div key={file.id} className="mb-8">
                    <h3 className="mb-3 text-base font-semibold text-zinc-900">
                      Module {file.moduleNumber}: {file.file.name} (
                      {file.questionCount} questions)
                    </h3>
                    <div className="overflow-x-auto rounded-xl border border-zinc-200">
                      <table className="min-w-full text-sm">
                        <thead className="bg-zinc-50">
                          <tr className="border-b border-zinc-200">
                            <th className="px-4 py-3 text-left font-semibold text-zinc-700">
                              Ref ID
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-zinc-700">
                              Tag
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-zinc-700">
                              Difficulty
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-zinc-700">
                              Question Text
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-zinc-700">
                              Instructions
                            </th>
                            <th className="px-4 py-3 text-left font-semibold text-zinc-700">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {file.questions.map((q, idx) => (
                            <tr key={idx} className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50">
                              <td className="px-4 py-3 text-zinc-900">
                                {q.reference_id}
                              </td>
                              <td className="px-4 py-3 text-zinc-900">
                                {q.tag}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`rounded-md px-2 py-1 text-xs font-medium ${
                                    q.difficulty === "easy"
                                      ? "bg-green-100 text-green-800"
                                      : q.difficulty === "medium"
                                      ? "bg-yellow-100 text-yellow-800"
                                      : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  {q.difficulty}
                                </span>
                              </td>
                              <td className="max-w-md px-4 py-3 text-zinc-900">
                                <MarkdownRenderer content={q.question_text} size="sm" />
                              </td>
                              <td className="max-w-md px-4 py-3 text-zinc-900">
                                <MarkdownRenderer content={q.instructions} size="sm" />
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => setSelectedQuestion(q)}
                                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 active:translate-y-px"
                                >
                                  View Details
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}

                <div className="mt-8 flex justify-end">
                  <button
                    onClick={handleUpload}
                    disabled={isUploading || !testTitle.trim()}
                    className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 active:translate-y-px disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-500"
                  >
                    {isUploading
                      ? "Uploading..."
                      : `Upload to ${examMode.toUpperCase()} Database`}
                  </button>
                </div>
              </div>
            )}

            {selectedQuestion && (
              <div className="fixed inset-0 bg-black/20 bg-opacity-30 flex items-center justify-center p-4 z-50">
                <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-gray-900">
                      Question Details
                    </h3>
                    <button
                      onClick={() => setSelectedQuestion(null)}
                      className="text-gray-500 hover:text-gray-700 text-2xl font-bold cursor-pointer"
                    >
                      ×
                    </button>
                  </div>

                  <div className="px-6 py-4 space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1">
                        Reference ID
                      </label>
                      <p className="text-gray-900">
                        {selectedQuestion.reference_id}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1">
                        Organization ID
                      </label>
                      <p className="text-gray-900">
                        {selectedQuestion.organization_id ||
                          organizationId.trim() ||
                          "Not set"}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1">
                        Tag
                      </label>
                      <p className="text-gray-900">{selectedQuestion.tag}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1">
                        Sub-skill
                      </label>
                      <p className="text-gray-900">
                        {selectedQuestion.sub_skill || "Not set"}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1">
                        Question bank visibility
                      </label>
                      <p className="text-gray-900">
                        {selectedQuestion.in_question_bank === undefined
                          ? `Uses upload default (${inQuestionBank ? "yes" : "no"})`
                          : selectedQuestion.in_question_bank
                          ? "Yes"
                          : "No"}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1">
                        Premium
                      </label>
                      <p className="text-gray-900">
                        {selectedQuestion.is_premium === undefined
                          ? `Uses upload default (${isPremium ? "yes" : "no"})`
                          : selectedQuestion.is_premium
                          ? "Yes"
                          : "No"}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1">
                        Difficulty
                      </label>
                      <span
                        className={`inline-block px-3 py-1 rounded text-sm font-medium ${
                          selectedQuestion.difficulty === "easy"
                            ? "bg-green-100 text-green-800"
                            : selectedQuestion.difficulty === "medium"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {selectedQuestion.difficulty}
                      </span>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1">
                        Instructions
                      </label>
                      <div className="text-gray-900">
                        <MarkdownRenderer content={selectedQuestion.instructions} />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1">
                        Question Text
                      </label>
                      <div className="text-gray-900">
                        <MarkdownRenderer content={selectedQuestion.question_text} />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1">
                        Image description
                      </label>
                      <div className="text-gray-900">
                        {selectedQuestion.image_description ? (
                          <MarkdownRenderer
                            content={selectedQuestion.image_description}
                          />
                        ) : (
                          "Not set"
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Answer Choices
                      </label>
                      <div className="space-y-2">
                        {selectedQuestion.answer_choices.map((choice, idx) => (
                          <div
                            key={idx}
                            className={`p-3 rounded border ${
                              (idx + 1).toString() ===
                              selectedQuestion.correct_answer
                                ? "bg-green-50 border-green-300"
                                : "bg-gray-50 border-gray-200"
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <span className="font-semibold text-gray-900 flex-shrink-0">
                                {String.fromCharCode(65 + idx)}.
                              </span>
                              <div className="flex-1">
                                <MarkdownRenderer content={choice} size="sm" />
                              </div>
                              {(idx + 1).toString() ===
                                selectedQuestion.correct_answer && (
                                <span className="ml-2 text-green-700 font-semibold text-xs flex-shrink-0">
                                  ✓ Correct
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-1">
                        Explanation
                      </label>
                      <div className="text-gray-900">
                        <MarkdownRenderer content={selectedQuestion.explanation} />
                      </div>
                    </div>
                  </div>

                  <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4">
                    <button
                      onClick={() => setSelectedQuestion(null)}
                      className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-medium cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
