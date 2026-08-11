"use client";

import { useEffect } from "react";
import { buildSourceExcerpt, cleanSourceText } from "@/lib/source-excerpts";

const SOURCE_SCAN_PATH = "/api/scan-sources";
const MAX_SOURCE_FILES = 5;
const MAX_SOURCE_TEXT_CHARS = 40_000;
const PDF_PARSE_WORKER_URL =
  "https://cdn.jsdelivr.net/npm/pdf-parse@2.4.5/dist/pdf-parse/web/pdf.worker.mjs";

type LocalSource = {
  id: string;
  name: string;
  size: number;
  content: string;
};

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

async function extractPdfText(file: File) {
  const { PDFParse } = await import("pdf-parse");
  PDFParse.setWorker(PDF_PARSE_WORKER_URL);

  const parser = new PDFParse({
    data: new Uint8Array(await file.arrayBuffer())
  });

  try {
    const parsed = await parser.getText();
    return parsed.text || "";
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(file: File) {
  const mammoth = (await import("mammoth")).default;
  const result = await mammoth.extractRawText({
    arrayBuffer: await file.arrayBuffer()
  });
  return result.value || "";
}

async function extractText(file: File) {
  if (isTextLike(file)) return file.text();
  if (isPdf(file)) return extractPdfText(file);
  if (isDocx(file)) return extractDocxText(file);
  throw new Error("Unsupported source file type.");
}

function responseJson(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

async function scanLocally(formData: FormData) {
  const files = formData
    .getAll("files")
    .filter((item): item is File => item instanceof File)
    .slice(0, MAX_SOURCE_FILES);

  let ids: string[] = [];
  try {
    const rawIds = JSON.parse(String(formData.get("ids") || "[]"));
    if (Array.isArray(rawIds)) {
      ids = rawIds.map((value) => String(value));
    }
  } catch {
    ids = [];
  }

  const notices: string[] = [];
  const sources: LocalSource[] = [];

  for (const [index, file] of files.entries()) {
    const id = ids[index] || `${file.name}-${file.size}-${file.lastModified}-${index}`;

    try {
      const fullText = cleanSourceText(await extractText(file));

      if (!fullText) {
        notices.push(
          `${file.name} has no readable text. If it is a scanned/image-only PDF, run OCR first or use a text-selectable PDF/DOCX.`
        );
        continue;
      }

      const content = buildSourceExcerpt(fullText, MAX_SOURCE_TEXT_CHARS);
      if (content.length < fullText.length) {
        notices.push(
          `${file.name} was condensed to the most useful excerpts so lesson generation stays within AI context limits.`
        );
      }

      sources.push({
        id,
        name: file.name,
        size: file.size,
        content
      });
    } catch (error) {
      console.error("Local source parsing failed", {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        error
      });

      const reason = error instanceof Error ? error.message : "Unknown parser error.";
      notices.push(`${file.name} could not be read locally (${reason}).`);
    }
  }

  if (formData.getAll("files").length > MAX_SOURCE_FILES) {
    notices.push(`Only ${MAX_SOURCE_FILES} source files can be read at one time.`);
  }

  return responseJson({ sources, notices });
}

function requestPath(input: RequestInfo | URL) {
  const raw =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;

  try {
    return new URL(raw, window.location.origin).pathname;
  } catch {
    return raw;
  }
}

export default function SourceParserBridge() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    const browserFetch: typeof window.fetch = async (input, init) => {
      const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();

      if (
        method === "POST" &&
        requestPath(input) === SOURCE_SCAN_PATH &&
        init?.body instanceof FormData
      ) {
        return scanLocally(init.body);
      }

      return originalFetch(input, init);
    };

    window.fetch = browserFetch;

    return () => {
      if (window.fetch === browserFetch) {
        window.fetch = originalFetch;
      }
    };
  }, []);

  return null;
}
