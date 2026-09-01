import { createClient } from "@supabase/supabase-js";

const QUESTION_MEDIA_BUCKET = "question-media";
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

const SUPPORTED_IMAGE_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export interface UploadedQuestionFigure {
  filename: string;
  objectPath: string;
  url: string;
  markdown: string;
}

function getStorageClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Figure upload service is not configured");
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function sanitizeFilename(filename: string) {
  const normalized = filename
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "figure";
}

function escapeMarkdownAltText(value: string) {
  return value.replace(/[\\[\\]]/g, "\\$&");
}

function assertValidImage(file: File) {
  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    throw new Error("Only PNG, JPG, WEBP, GIF, and AVIF images are supported");
  }

  if (file.size === 0 || file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error("Each image must be 20 MB or smaller");
  }
}

export async function uploadQuestionFigure(
  file: File
): Promise<UploadedQuestionFigure> {
  assertValidImage(file);

  const supabase = getStorageClient();
  const objectPath = `bulk-figures/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;

  const { data, error } = await supabase.storage
    .from(QUESTION_MEDIA_BUCKET)
    .upload(objectPath, file, {
      cacheControl: "31536000",
      contentType: file.type,
      upsert: false,
    });

  if (error || !data?.path) {
    throw new Error("Unable to store this image");
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(QUESTION_MEDIA_BUCKET).getPublicUrl(data.path);

  return {
    filename: file.name,
    objectPath: data.path,
    url: publicUrl,
    markdown: `![${escapeMarkdownAltText(file.name)}](${publicUrl})`,
  };
}
