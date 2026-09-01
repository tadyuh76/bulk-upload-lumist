import { NextRequest, NextResponse } from "next/server";
import { uploadQuestionFigure } from "@/lib/question-media.server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Choose an image to upload." },
        { status: 400 }
      );
    }

    const uploadedFigure = await uploadQuestionFigure(file);
    return NextResponse.json(uploadedFigure);
  } catch (error) {
    console.error("Question figure upload failed", error);

    const message =
      error instanceof Error &&
      (error.message === "Only PNG, JPG, WEBP, GIF, and AVIF images are supported" ||
        error.message === "Each image must be 20 MB or smaller")
        ? error.message
        : "Image upload failed. Please try again.";

    return NextResponse.json(
      { error: message },
      {
        status:
          message === "Image upload failed. Please try again." ? 500 : 400,
      }
    );
  }
}
