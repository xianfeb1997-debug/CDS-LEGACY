"use client";

import { useEffect, useMemo, useState } from "react";

type ReasoningEffort = "low" | "medium" | "high";

const STORAGE_KEY = "cds_reasoning_effort";
const GENERATION_PATHS = new Set(["/api/generate", "/api/generate-las"]);

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

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isReasoningEffort(stored)) setEffort(stored);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, effort);
  }, [effort]);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    const reasoningFetch: typeof window.fetch = async (input, init) => {
      const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
      const path = requestPath(input);

      if (
        method === "POST" &&
        GENERATION_PATHS.has(path) &&
        typeof init?.body === "string"
      ) {
        try {
          const payload = JSON.parse(init.body) as Record<string, unknown>;
          return originalFetch(input, {
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

  return (
    <aside
      aria-label="AI thinking level"
      style={{
        position: "fixed",
        right: 18,
        bottom: 18,
        zIndex: 1200,
        width: 248,
        border: "1px solid rgba(15, 23, 42, 0.14)",
        borderRadius: 16,
        padding: 14,
        background: "rgba(255, 255, 255, 0.96)",
        boxShadow: "0 12px 32px rgba(15, 23, 42, 0.16)",
        backdropFilter: "blur(10px)"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div>
          <strong style={{ display: "block", fontSize: 13 }}>AI Thinking</strong>
          <span style={{ display: "block", marginTop: 2, fontSize: 11, color: "#64748b" }}>
            OpenAI + Gemini
          </span>
        </div>
        <select
          aria-label="AI thinking level"
          value={effort}
          onChange={(event) => setEffort(event.target.value as ReasoningEffort)}
          style={{
            minWidth: 100,
            border: "1px solid #cbd5e1",
            borderRadius: 10,
            padding: "7px 9px",
            background: "white",
            fontSize: 12,
            fontWeight: 700
          }}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <p style={{ margin: "9px 0 0", fontSize: 11, lineHeight: 1.45, color: "#475569" }}>
        {helper}
      </p>
    </aside>
  );
}
