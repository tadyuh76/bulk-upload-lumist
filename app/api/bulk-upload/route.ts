import { NextRequest, NextResponse } from "next/server";
import { uploadBulkData } from "@/lib/bulk-upload.server";
import type { ExamMode, ModuleData, UploadOptions } from "@/lib/upload-types";

export const runtime = "nodejs";

const EXAM_MODES: ExamMode[] = ["sat", "ap", "act"];

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      modules?: ModuleData[];
      testTitle?: string;
      testDescription?: string;
      examMode?: ExamMode;
      options?: UploadOptions;
    };

    if (
      !Array.isArray(body.modules) ||
      body.modules.length === 0 ||
      !body.testTitle?.trim() ||
      !body.options ||
      !EXAM_MODES.includes(body.examMode as ExamMode)
    ) {
      return NextResponse.json(
        { error: "Please review the upload details and try again." },
        { status: 400 }
      );
    }

    const result = await uploadBulkData(
      body.modules,
      body.testTitle.trim(),
      body.testDescription?.trim() ?? "",
      body.examMode as ExamMode,
      body.options
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Bulk upload failed", error);
    return NextResponse.json(
      { error: "Upload failed. No questions were added." },
      { status: 500 }
    );
  }
}
