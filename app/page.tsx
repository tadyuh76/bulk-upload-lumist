"use client";

import { useState } from "react";
import { parseExcelFile, convertParsedQuestions } from "@/lib/excel-parser";
import {
  uploadBulkData,
  type ModuleData,
  type UploadProgress,
} from "@/lib/database";
import { Question } from "@/lib/supabase";
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

interface FileWithModule {
  id: string;
  file: File;
  moduleNumber: number;
  questionCount: number;
  questions: Question[];
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
      className="flex items-center justify-between p-4 bg-white border border-gray-300 rounded-lg shadow-sm"
    >
      <div
        className="flex items-center gap-4 flex-1"
        {...attributes}
        {...listeners}
      >
        <div className="cursor-grab">
          <svg
            className="w-6 h-6 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8h16M4 16h16"
            />
          </svg>
        </div>
        <div className="flex-1">
          <div className="font-semibold text-gray-900">
            Module {file.moduleNumber}
          </div>
          <div className="text-sm text-gray-800">{file.file.name}</div>
          <div className="text-xs text-gray-700">
            {file.questionCount} questions
          </div>
        </div>
      </div>
      <button
        onClick={onRemove}
        className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
      >
        Remove
      </button>
    </div>
  );
}

export default function Home() {
  const [files, setFiles] = useState<FileWithModule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(
    null
  );
  const [testTitle, setTestTitle] = useState("");
  const [testDescription, setTestDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    test_id: string;
    total_questions: number;
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

  const handleUpload = async () => {
    if (!testTitle.trim()) {
      setError("Please enter a test title");
      return;
    }

    if (files.length === 0) {
      setError("Please upload at least one file");
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
        (progress) => setUploadProgress(progress)
      );

      setSuccess(result);
      setFiles([]);
      setTestTitle("");
      setTestDescription("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Bulk Upload Excel Files
          </h1>
          <p className="text-gray-800 mb-8">
            Upload 1-4 Excel files for test modules, reorder them, preview, and
            upload to database
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 text-sm">
                Successfully uploaded! Test ID:{" "}
                <span className="font-mono font-semibold">
                  {success.test_id}
                </span>{" "}
                with {success.total_questions} questions
              </p>
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Test Title *
              </label>
              <input
                type="text"
                value={testTitle}
                onChange={(e) => setTestTitle(e.target.value)}
                placeholder="e.g., Exam 1"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                disabled={isUploading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Test Description
              </label>
              <textarea
                value={testDescription}
                onChange={(e) => setTestDescription(e.target.value)}
                placeholder="e.g., Practice Exam 1"
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                disabled={isUploading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Upload Excel Files (Max 4)
              </label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                multiple
                onChange={handleFileUpload}
                disabled={isLoading || isUploading || files.length >= 4}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-gray-700 mt-1">
                Upload Excel/CSV files containing questions. {files.length}/4
                files uploaded
              </p>
            </div>

            {isLoading && (
              <div className="text-center py-4">
                <p className="text-gray-900">Processing files...</p>
              </div>
            )}

            {files.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">
                  Uploaded Files
                </h2>
                <p className="text-sm text-gray-800 mb-3">
                  Drag to reorder modules
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
              <div className="mb-6">
                <button
                  onClick={handlePreview}
                  className="px-4 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 transition font-medium cursor-pointer"
                  disabled={isUploading}
                >
                  {isPreviewing ? "Hide Preview" : "Show Preview"}
                </button>
              </div>
            )}

            {isUploading && uploadProgress && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-6">
                <p className="text-blue-900 font-medium mb-2">
                  {uploadProgress.message}
                </p>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${
                        (uploadProgress.current / uploadProgress.total) * 100
                      }%`,
                    }}
                  />
                </div>
                <p className="text-sm text-blue-700 mt-1">
                  {uploadProgress.current} / {uploadProgress.total}
                </p>
              </div>
            )}

            {isPreviewing && files.length > 0 && (
              <div className="border-t pt-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Data Preview
                </h2>
                {files.map((file) => (
                  <div key={file.id} className="mb-8">
                    <h3 className="font-semibold text-gray-900 mb-3 text-base">
                      Module {file.moduleNumber}: {file.file.name} (
                      {file.questionCount} questions)
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full border border-gray-900 text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-4 py-3 border border-gray-900 text-left font-semibold text-gray-900">
                              Ref ID
                            </th>
                            <th className="px-4 py-3 border border-gray-900 text-left font-semibold text-gray-900">
                              Tag
                            </th>
                            <th className="px-4 py-3 border border-gray-900 text-left font-semibold text-gray-900">
                              Difficulty
                            </th>
                            <th className="px-4 py-3 border border-gray-900 text-left font-semibold text-gray-900">
                              Question Text
                            </th>
                            <th className="px-4 py-3 border border-gray-900 text-left font-semibold text-gray-900">
                              Instructions
                            </th>
                            <th className="px-4 py-3 border border-gray-900 text-left font-semibold text-gray-900">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {file.questions.map((q, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="px-4 py-3 border border-gray-900 text-gray-900">
                                {q.reference_id}
                              </td>
                              <td className="px-4 py-3 border border-gray-900 text-gray-900">
                                {q.tag}
                              </td>
                              <td className="px-4 py-3 border border-gray-900">
                                <span
                                  className={`px-2 py-1 rounded text-xs font-medium ${
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
                              <td className="px-4 py-3 border border-gray-900 text-gray-900 max-w-md">
                                <MarkdownRenderer content={q.question_text} size="sm" />
                              </td>
                              <td className="px-4 py-3 border border-gray-900 text-gray-900 max-w-md">
                                <MarkdownRenderer content={q.instructions} size="sm" />
                              </td>
                              <td className="px-4 py-3 border border-gray-900">
                                <button
                                  onClick={() => setSelectedQuestion(q)}
                                  className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition cursor-pointer"
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

                <div className="mt-8 flex justify-center">
                  <button
                    onClick={handleUpload}
                    disabled={isUploading || !testTitle.trim()}
                    className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-medium cursor-pointer text-lg"
                  >
                    {isUploading ? "Uploading..." : "Upload to Database"}
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
                        Tag
                      </label>
                      <p className="text-gray-900">{selectedQuestion.tag}</p>
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
        </div>
      </div>
    </div>
  );
}
