"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type ReasoningEffort = "low" | "medium" | "high";

const STORAGE_KEY = "cds_reasoning_effort";
const PREVIEW_ROUTES: Record<string, string> = {
  "/api/generate": "/api/preview/generate",
  "/api/generate-las": "/api/preview/generate-las"
};

const effortCopy: Record<ReasoningEffort, { label: string; helper: string }> = {
  low: {
    label: "Low",
    helper: "Faster generation with lighter reasoning."
  },
  medium: {
    label: "Medium",
    helper: "Balanced quality, speed, and cost. Recommended."
  },
  high: {
    label: "High",
    helper: "Deeper planning and alignment checks. Slower and potentially more costly."
  }
};

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

function isReasoningEffort(value: string | null): value is ReasoningEffort {
  return value === "low" || value === "medium" || value === "high";
}

export default function ReasoningLevelControl() {
  const [effort, setEffort] = useState<ReasoningEffort>("medium");
  const [formTarget, setFormTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isReasoningEffort(stored)) setEffort(stored);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, effort);
  }, [effort]);

  useEffect(() => {
    const locateTarget = () => {
      const target = document.querySelector<HTMLElement>(".duration-detail-row");
      if (target) setFormTarget(target);
      return Boolean(target);
    };

    if (locateTarget()) return;

    const observer = new MutationObserver(() => {
      if (locateTarget()) observer.disconnect();
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    const reasoningFetch: typeof window.fetch = async (input, init) => {
      const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
      const path = requestPath(input);
      const previewRoute = PREVIEW_ROUTES[path];

      if (method === "POST" && previewRoute && typeof init?.body === "string") {
        try {
          const payload = JSON.parse(init.body) as Record<string, unknown>;
          return originalFetch(previewRoute, {
            ...init,
            body: JSON.stringify({ ...payload, reasoningEffort: effort })
          });
        } catch {
          // If the body is not JSON, preserve the original request unchanged.
        }
      }

      return originalFetch(input, init);
    };

    window.fetch = reasoningFetch;

    return () => {
      if (window.fetch === reasoningFetch) {
        window.fetch = originalFetch;
      }
    };
  }, [effort]);

  const helper = useMemo(() => effortCopy[effort].helper, [effort]);

  if (!formTarget) return null;

  return createPortal(
    <div className="field" style={{ gridColumn: "1 / -1" }}>
      <label htmlFor="ai-thinking-level">AI Thinking</label>
      <select
        id="ai-thinking-level"
        aria-label="AI thinking level"
        value={effort}
        onChange={(event) => setEffort(event.target.value as ReasoningEffort)}
      >
        <option value="low">Low - faster</option>
        <option value="medium">Medium - recommended</option>
        <option value="high">High - deeper reasoning</option>
      </select>
      <p className="field-help" style={{ marginTop: 6 }}>
        {helper} Applies to Lesson Plan and Activity Sheet generation for supported OpenAI and Gemini models.
      </p>
    </div>,
    formTarget
  );
}
