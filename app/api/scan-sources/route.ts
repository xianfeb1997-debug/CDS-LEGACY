import { NextResponse } from "next/server";
import { createRequire } from "node:module";
import mammoth from "mammoth";
import { cleanSourceText } from "@/lib/source-excerpts";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_SOURCE_FILES = 5;
const MAX_SOURCE_FILE_BYTES = 10 * 1024 * 1024;

type ScannedSource = {
  id: string;
  name: string;
  size: number;
  content: string;
};

type PdfParseModule = typeof import("pdf-parse");

const requireFromRoute = createRequire(import.meta.url);

function extensionOf(name: string) {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || "";
}

function isTextLike(file: File) {
  const extension = extensionOf(file.name);
  return (
    file.type.startsWith("text/") ||
    ["application/json", "application/xml", "text/rtf"].includes(file.type) ||
    ["txt", "text", "md", "markdown", "csv", "json", "html", "htm", "rtf", "xml"].includes(extension)
  );
}

function isPdf(file: File) {
  return file.type === "application/pdf" || extensionOf(file.name) === "pdf";
}

function isDocx(file: File) {
  return (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    extensionOf(file.name) === "docx"
  );
}

async function extractText(file: File) {
  if (isTextLike(file)) {
    return file.text();
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (isPdf(file)) {
    const { PDFParse } = requireFromRoute("pdf-parse") as PdfParseModule;
    const parser = new PDFParse({ data: buffer });
    try {
      const parsed = await parser.getText();
      return parsed.text || "";
    } finally {
      await parser.destroy();
    }
  }

  if (isDocx(file)) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  }

  throw new Error("Unsupported source file type.");
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files").filter((item): item is File => item instanceof File);
    const ids = JSON.parse(String(formData.get("ids") || "[]")) as string[];
    const notices: string[] = [];
    const sources: ScannedSource[] = [];

    for (const [index, file] of files.slice(0, MAX_SOURCE_FILES).entries()) {
      const id = ids[index] || `${file.name}-${file.size}-${Date.now()}-${index}`;

      if (file.size > MAX_SOURCE_FILE_BYTES) {
        notices.push(`${file.name} is larger than 10 MB.`);
        continue;
      }

      if (!isTextLike(file) && !isPdf(file) && !isDocx(file)) {
        notices.push(`${file.name} is not a supported source file.`);
        continue;
      }

      try {
        const text = cleanSourceText(await extractText(file));
        if (!text) {
          notices.push(`${file.name} has no readable text. Scanned-image PDFs may need OCR before upload.`);
          continue;
        }

        sources.push({
          id,
          name: file.name,
          size: file.size,
          content: text
        });
      } catch {
        notices.push(`${file.name} could not be scanned. Try a text-selectable PDF or DOCX file.`);
      }
    }

    if (files.length > MAX_SOURCE_FILES) {
      notices.push(`Only ${MAX_SOURCE_FILES} source files can be scanned at one time.`);
    }

    return NextResponse.json({ sources, notices });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to scan source files."
      },
      { status: 400 }
    );
  }
}
