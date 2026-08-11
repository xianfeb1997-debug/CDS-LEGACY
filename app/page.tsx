"use client";

import {
  ArrowRight,
  Building2,
  BookOpenCheck,
  BrainCircuit,
  CheckCircle2,
  Clipboard,
  Download,
  Eye,
  FileText,
  Globe2,
  GraduationCap,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  LayoutTemplate,
  Loader2,
  MonitorPlay,
  Presentation,
  Printer,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  User,
  UserPlus,
  Workflow,
  X
} from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  defaultInput,
  pptImageModels,
  pptImageStylePresets,
  pptThemes,
  rubricItems,
  type GeneratedLesson,
  type LessonInput,
  type SessionPlan
} from "@/lib/schemas";
import { cleanObjectiveText, formatIntegrationText, formatSessionHeaderLabel } from "@/lib/lesson-format";
import { OFFICIAL_TEMPLATE_HELPERS, OFFICIAL_TEMPLATE_NARRATIVES, SELF_CHECK_RUBRIC_TITLE } from "@/lib/template-constants";

type SelectOption = string | { value: string; label: string };
type SelectGroup = { label: string; options: SelectOption[] };

type AuthMode = "login" | "signup";

type PublicAccessSettings = {
  allowNewSignups: boolean;
  maintenance: {
    enabled: boolean;
    until: string;
    message: string;
  };
};

const defaultPublicAccessSettings: PublicAccessSettings = {
  allowNewSignups: true,
  maintenance: {
    enabled: false,
    until: "",
    message: ""
  }
};

type VisualPickerOption = {
  value: string;
  label: string;
  helper: string;
  tag?: string;
  previewClass?: string;
  previewImage?: string;
  previewType?: "theme" | "model" | "style";
};

const gradeLevelGroups: SelectGroup[] = [
  { label: "Primary", options: ["Grade 1", "Grade 2", "Grade 3"] },
  { label: "Intermediate", options: ["Grade 4", "Grade 5", "Grade 6"] },
  { label: "Junior High School", options: ["Grade 7", "Grade 8", "Grade 9", "Grade 10"] },
  { label: "Senior High School", options: ["Grade 11", "Grade 12"] }
];

const subjectGroups: SelectGroup[] = [
  {
    label: "K-10 Core Subjects",
    options: [
      "English",
      "Filipino",
      "Mathematics",
      "Science",
      "Araling Panlipunan",
      "EsP (Edukasyon sa Pagpapakatao)",
      "GMRC (Good Manners and Right Conduct)",
      "Values Education",
      "MAPEH",
      "TLE",
      "EPP (Edukasyong Pantahanan at Pangkabuhayan)",
      { value: "Others-K10", label: "Others (K-10)" }
    ]
  },
  {
    label: "SHS Core Subjects (SSHS)",
    options: [
      "Effective Communication",
      "Mabisang Komunikasyon",
      "General Mathematics",
      "General Science",
      "Life and Career Skills",
      "Pag-aaral ng Kasaysayan at Lipunang Pilipino"
    ]
  },
  {
    label: "SHS Academic Electives — Arts, Social Sciences & Humanities",
    options: [
      "Arts 1 - Creative Industries (Visual, Literary, Media, Applied, Traditional Art)",
      "Arts 2 - Creative Industries (Music, Dance, Theater)",
      "Citizenship and Civic Engagement",
      "Contemporary Literature 1",
      "Contemporary Literature 2",
      "Creative Composition 1",
      "Creative Composition 2",
      "Filipino 1 - Wika at Komunikasyon sa Akademikong Filipino",
      "Filipino 2 - Filipino para sa Larang Teknikal Propesyonal",
      "Filipino 2 - Filipino sa Isports",
      "Filipino 2 - Filipino sa Sining at Disenyo",
      "Filipino Identity Through the Arts",
      "Introduction to Philosophy",
      "Leadership and Management in the Arts",
      "Malikhaing Pagsulat",
      "Philippine Governance / Philippine Politics and Governance",
      "Social Sciences Theory and Practice"
    ]
  },
  {
    label: "SHS Academic Electives — Business & Entrepreneurship",
    options: [
      "Business 1 - Basic Accounting",
      "Business 2 - Business Finance and Income Taxation",
      "Business 3 - Business Economics",
      "Contemporary Marketing",
      "Entrepreneurship",
      "Introduction to Organization and Management"
    ]
  },
  {
    label: "SHS Academic Electives — STEM",
    options: [
      "Biology 1",
      "Biology 2",
      "Chemistry 1",
      "Chemistry 2",
      "Earth and Space Science 1",
      "Earth and Space Science 2",
      "Finite Mathematics 1",
      "Finite Mathematics 2",
      "Physics 1",
      "Physics 2"
    ]
  },
  {
    label: "SHS Academic Electives — Sports, Health & Wellness",
    options: [
      "Human Movement 1 - Basic Anatomy in Sports and Exercise",
      "Human Movement 2 - Motor Skills Development",
      "Physical Education 1 - Fitness and Recreation",
      "Physical Education 2 - Sports and Dance",
      "Sports Activity Management",
      "Sports Coaching",
      "Sports Officiating"
    ]
  },
  {
    label: "SHS Grade 12 Electives — STEM",
    options: [
      "Advanced Mathematics",
      "Basic Calculus",
      "Pre-Calculus",
      "Biology 3",
      "Biology 4",
      "Chemistry 3",
      "Chemistry 4",
      "Physics 3",
      "Physics 4",
      "Earth and Space Science 3",
      "Earth and Space Science 4",
      "Conceptual Biology and Earth and Space Science",
      "Conceptual Physics and Chemistry in Daily Life",
      "Database Management",
      "Empowerment Technologies",
      "Fundamentals of Data Analytics"
    ]
  },
  {
    label: "SHS Grade 12 Electives — Arts, Social Sciences & Humanities",
    options: ["Creative Production and Presentation"]
  },
  {
    label: "SHS Grade 12 Electives — Field Experience",
    options: [
      "Arts Apprenticeship - Dance",
      "Arts Apprenticeship - Literary Arts",
      "Arts Apprenticeship - Media Arts",
      "Arts Apprenticeship - Music",
      "Arts Apprenticeship - Theater Arts",
      "Arts Apprenticeship - Traditional Cultural Expressions",
      "Arts Apprenticeship - Visual",
      "Design and Innovation",
      "In-Campus Field Exposure for Sports",
      "Research 1",
      "Research 2"
    ]
  },
  {
    label: "SHS Grade 12 Electives — Sports, Health & Wellness",
    options: [
      "Exercise and Sports Programming",
      "First Aid",
      "Fundamentals of Basic Life Support"
    ]
  },
  {
    label: "Sa Kahilingan ng mga Guro (By Request of Teachers)",
    options: [
      "Filipino sa Piling Larang - Akademik",
      "Filipino sa Piling Larang - Tech-Voc"
    ]
  },
  {
    label: "Other",
    options: [{ value: "Others-SHS", label: "Others (SHS)" }]
  }
];

const knownSubjectValues = subjectGroups.flatMap((group) =>
  group.options.map((option) => (typeof option === "string" ? option : option.value))
);

function optionValue(option: SelectOption) {
  return typeof option === "string" ? option : option.value;
}

function optionLabel(option: SelectOption) {
  return typeof option === "string" ? option : option.label;
}

function subjectSelectValue(value?: string) {
  const current = (value || "").trim();
  if (!current) return "";
  if (current === "Others (K-10)") return "Others-K10";
  if (current === "Others (SHS)") return "Others-SHS";
  if (knownSubjectValues.includes(current)) return current;
  return "Others-SHS";
}

function subjectValueFromChoice(value: string) {
  if (value === "Others-K10") return "Others (K-10)";
  if (value === "Others-SHS") return "Others (SHS)";
  return value;
}

function isOtherSubjectSelected(value?: string) {
  const current = (value || "").trim();
  if (!current) return false;
  return current.startsWith("Others") || !knownSubjectValues.includes(current);
}

function customSubjectValue(value?: string) {
  const current = (value || "").trim();
  return current.startsWith("Others") ? "" : current;
}

const weekOptions = ["", ...Array.from({ length: 12 }, (_, index) => `Week ${index + 1}`)];
const languageOptions = ["English", "Filipino", "Bilingual"];
const termOptions = ["Term 1", "Term 2", "Term 3"];
const paperSizeOptions = ["A4", "Letter", "Legal", "Folio"];
const orientationOptions = ["Landscape", "Portrait"];
const outputDepthOptions = ["Concise", "Short", "Detailed", "Comprehensive"];
const pptThemeOptions: VisualPickerOption[] = [
  {
    value: "Basic Light",
    label: "Basic Light",
    tag: "Clean",
    previewClass: "theme-basic-light",
    previewType: "theme",
    helper: "Bright white classroom deck with soft blue accents and readable content blocks."
  },
  {
    value: "Rush",
    label: "Rush",
    tag: "Bold",
    previewClass: "theme-rush",
    previewType: "theme",
    helper: "Energetic red-orange presentation style for recaps, activities, and key moments."
  },
  {
    value: "Borealis",
    label: "Borealis",
    tag: "Modern",
    previewClass: "theme-borealis",
    previewType: "theme",
    helper: "Dark projector-friendly deck with blue glow, strong contrast, and modern cards."
  },
  {
    value: "Cornfield",
    label: "Cornfield",
    tag: "Warm",
    previewClass: "theme-cornfield",
    previewType: "theme",
    helper: "Warm yellow-gold classroom visuals with friendly cards and soft contrast."
  },
  {
    value: "Daydream",
    label: "Daydream",
    tag: "Soft",
    previewClass: "theme-daydream",
    previewType: "theme",
    helper: "Light pastel education layout with calm gradients, airy spacing, and clean cards."
  },
  {
    value: "Terracotta",
    label: "Terracotta",
    tag: "Classic",
    previewClass: "theme-terracotta",
    previewType: "theme",
    helper: "Professional warm neutral deck with soft clay accents and polished readability."
  }
];
const pptPageCountOptions = [
  { value: "20", label: "20 slides - compact" },
  { value: "30", label: "30 slides - standard" },
  { value: "40", label: "40 slides - full week" },
  { value: "50", label: "50 slides - expanded" },
  { value: "60", label: "60 slides - maximum" }
];
const pptImageModelOptions: SelectOption[] = [
  { value: "imagen-4-fast", label: "Imagen 4 Fast - balanced classroom visuals" },
  { value: "flux-2-klein", label: "Flux 2 Fast - fast everyday slide images" },
  { value: "flux-kontext-fast", label: "Flux Kontext Fast - accurate prompt following" },
  { value: "ideogram-v3-turbo", label: "Ideogram 3 Turbo - text-aware visuals" },
  { value: "luma-photon-flash-1", label: "Luma Photon Flash - cinematic but efficient" },
  { value: "recraft-v4", label: "Recraft V4 - polished graphics and icons" }
];
const pptImageStyleOptions: VisualPickerOption[] = [
  {
    value: "3D",
    label: "3D",
    tag: "Default",
    previewClass: "style-3d",
    previewImage: "/gamma-style-previews/3d.png",
    previewType: "style",
    helper: "Friendly rendered objects, icons, and metaphors for engaging slide visuals."
  },
  {
    value: "photo",
    label: "Photo",
    tag: "Realistic",
    previewClass: "style-photo",
    previewImage: "/gamma-style-previews/photo.png",
    previewType: "style",
    helper: "Real photo-style visuals for practical classroom scenarios and learner examples."
  },
  {
    value: "scene",
    label: "Scene",
    tag: "Scenic",
    previewClass: "style-scene",
    previewImage: "/gamma-style-previews/scene.png",
    previewType: "style",
    helper: "Immersive setting visuals for real-world context, simulations, and concept scenes."
  },
  {
    value: "cinematic",
    label: "Cinematic",
    tag: "Realistic",
    previewClass: "style-cinematic",
    previewImage: "/gamma-style-previews/cinematic.png",
    previewType: "style",
    helper: "Story-driven realistic scenes with dramatic light for lesson hooks and scenarios."
  },
  {
    value: "illustration",
    label: "Illustration",
    tag: "Scenic",
    previewClass: "style-illustration",
    previewImage: "/gamma-style-previews/illustration.png",
    previewType: "style",
    helper: "Modern education illustration with clear shapes, approachable colors, and scenes."
  },
  {
    value: "technicalLine",
    label: "Technical Line",
    tag: "Diagrams",
    previewClass: "style-technical-line",
    previewImage: "/gamma-style-previews/technical-line.png",
    previewType: "style",
    helper: "Clean diagram-style visuals for formulas, steps, workflows, and structured concepts."
  }
];
const sessionOptions = [
  { value: "1", label: "1 session" },
  { value: "2", label: "2 sessions" },
  { value: "3", label: "3 sessions" },
  { value: "4", label: "4 sessions" },
  { value: "5", label: "5 sessions (full week)" }
];

const MAX_SOURCE_FILES = 5;
const MAX_SOURCE_FILE_BYTES = 10 * 1024 * 1024;
const sourceFileAccept = ".pdf,.docx,.txt,.text,.md,.markdown,.csv,.json,.html,.htm,.rtf,.xml";

type UploadedSource = {
  id: string;
  name: string;
  size: number;
  content: string;
};

type ScanSourcesResponse = {
  sources?: UploadedSource[];
  notices?: string[];
  error?: string;
};

type ApiUsage = {
  date: string;
  timezone: string;
  configured: boolean;
  source: "openai" | "gateway" | "custom" | "counter" | "unavailable";
  providerName?: string;
  usedUsd: number;
  limitUsd: number | null;
  remainingUsd: number | null;
  percent: number | null;
  quotaType?: "cost" | "count";
  usedCount?: number | null;
  limitCount?: number | null;
  remainingCount?: number | null;
  averageCostUsd?: number | null;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  requests: number;
  modelBreakdown?: { model: string; requests: number; inputTokens: number; outputTokens: number }[];
  message?: string;
};

type GammaPptResponse = {
  generationId: string;
  status?: "pending" | "running" | "completed";
  gammaId?: string;
  gammaUrl?: string;
  exportUrl?: string;
  credits?: { deducted?: number; remaining?: number };
  warnings?: string | string[];
  message?: string;
  error?: string;
};

type PptCreditState = {
  configured: boolean;
  source: "database" | "memory" | "env" | "custom" | "unknown";
  used?: number | null;
  limit?: number | null;
  remaining: number | null;
  lastDeducted: number | null;
  updatedAt: string | null;
  message?: string;
};

const GAMMA_CLIENT_POLL_INTERVAL_MS = 8000;

function formatNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0";
  return value.toLocaleString();
}

type FieldValue = string | number;

type RequiredFieldKey =
  | "gradeLevelSection"
  | "learningArea"
  | "term"
  | "week"
  | "teachingDates"
  | "sessionDurationMinutes"
  | "learningCompetency"
  | "contentStandard"
  | "performanceStandard";

type FieldErrors = Partial<Record<RequiredFieldKey, string>>;
type StatusTone = "success" | "error";
type PreviewTab = "lesson" | "activity" | "presentation";

const requiredFieldLabels: Record<RequiredFieldKey, string> = {
  gradeLevelSection: "Grade Level",
  learningArea: "Learning Area / Subject",
  term: "Quarter / Term",
  week: "Week",
  teachingDates: "Teaching Dates",
  sessionDurationMinutes: "Duration of Each Session",
  learningCompetency: "Learning Competency",
  contentStandard: "Content Standard",
  performanceStandard: "Performance Standard"
};

const requiredFieldOrder = Object.keys(requiredFieldLabels) as RequiredFieldKey[];

function isRequiredFieldKey(name: keyof LessonInput): name is RequiredFieldKey {
  return Object.prototype.hasOwnProperty.call(requiredFieldLabels, name);
}

function validateLessonForm(values: LessonInput): FieldErrors {
  const errors: FieldErrors = {};
  const duration = Number(values.sessionDurationMinutes || 0);

  if (!values.gradeLevelSection) errors.gradeLevelSection = "Select a grade level.";
  if (!values.learningArea) errors.learningArea = "Select or enter the learning area.";
  if (!values.term) errors.term = "Select a quarter or term.";
  if (!values.week) errors.week = "Select a week.";
  if (!values.teachingDates.trim()) errors.teachingDates = "Enter the teaching dates.";
  if (!Number.isFinite(duration) || duration < 10 || duration > 240) {
    errors.sessionDurationMinutes = "Enter a duration from 10 to 240 minutes.";
  }
  if (!values.learningCompetency.trim()) errors.learningCompetency = "Paste the learning competency.";
  if (!values.contentStandard.trim()) errors.contentStandard = "Paste the content standard.";
  if (!values.performanceStandard.trim()) errors.performanceStandard = "Paste the performance standard.";

  return errors;
}

function inputValue(value: string | undefined) {
  return value || "";
}

function base64ToBlob(base64: string, contentType: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: contentType });
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function generationErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const displayMessage = message
    .replace(/Gamma/gi, "PPT service")
    .replace(/Gemini Chat/gi, "AI provider")
    .replace(/Gemini/gi, "AI provider")
    .replace(/OpenAI/gi, "AI provider");

  if (/AI generation failed/i.test(displayMessage)) {
    if (/429|rate limit|quota/i.test(displayMessage)) {
      return "AI generation failed because the provider rate limit or quota was reached. No lesson plan was generated. Please try again later or use another configured AI key/provider.";
    }
    return "AI generation failed. No lesson plan was generated. Please try again after checking the AI provider settings.";
  }
  if (/not configured|api key|unauthorized|401/i.test(displayMessage)) {
    return "AI generation is not configured or authorized. No lesson plan was generated. Please check the AI API key/provider settings.";
  }
  if (/daily global|limit reached/i.test(displayMessage)) return displayMessage;
  if (/429|rate limit|quota/i.test(displayMessage)) {
    return "AI generation failed because the provider rate limit or quota was reached. No lesson plan was generated. Please try again later.";
  }
  if (/json|responses|chat completions|status code|ai lesson/i.test(displayMessage)) {
    return "AI generation failed because the provider returned an invalid response. No lesson plan was generated. Please try again, or reduce uploaded source text if the request is too large.";
  }
  return displayMessage || "Generation failed.";
}

function isSupportedSourceFile(file: File) {
  const name = file.name.toLowerCase();
  return (
    file.type.startsWith("text/") ||
    [
      "application/json",
      "application/xml",
      "text/rtf",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ].includes(file.type) ||
    /\.(pdf|docx|txt|text|md|markdown|csv|json|html?|rtf|xml)$/i.test(name)
  );
}

function buildSourceMaterials(sources: UploadedSource[]) {
  return sources
    .map((source, index) => `Source ${index + 1}: ${source.name}\n${source.content}`)
    .join("\n\n---\n\n");
}

function buildSourceReferences(sources: UploadedSource[]) {
  return sources.map((source, index) => `${index + 1}. ${source.name}`).join("\n");
}

async function scanSourceFiles(files: File[], ids: string[]) {
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));
  formData.append("ids", JSON.stringify(ids));

  const response = await fetch("/api/scan-sources", {
    method: "POST",
    body: formData
  });
  const body = (await response.json()) as ScanSourcesResponse;

  if (!response.ok) {
    throw new Error(body.error || "Unable to scan source files.");
  }

  return body;
}

export default function Home() {
  const [form, setForm] = useState<LessonInput>(defaultInput);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingLAS, setIsGeneratingLAS] = useState(false);
  const [isGeneratingPPT, setIsGeneratingPPT] = useState(false);
  const [isAutoPollingPPT, setIsAutoPollingPPT] = useState(false);
  const [status, setStatus] = useState("");
  const [statusTone, setStatusTone] = useState<StatusTone>("success");
  const [showPreview, setShowPreview] = useState(false);
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null);
  const [generatedFilename, setGeneratedFilename] = useState("");
  const [generatedLesson, setGeneratedLesson] = useState<GeneratedLesson | null>(null);
  const [generatedLasBlob, setGeneratedLasBlob] = useState<Blob | null>(null);
  const [generatedLasFilename, setGeneratedLasFilename] = useState("");
  const [generatedPptExportUrl, setGeneratedPptExportUrl] = useState("");
  const [generatedPptGammaUrl, setGeneratedPptGammaUrl] = useState("");
  const [pendingGammaGenerationId, setPendingGammaGenerationId] = useState("");
  const [apiUsage, setApiUsage] = useState<ApiUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [pptCredits, setPptCredits] = useState<PptCreditState | null>(null);
  const [pptCreditsLoading, setPptCreditsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessKey, setAccessKey] = useState("");
  const [accessStatus, setAccessStatus] = useState("");
  const [isCheckingAccessKey, setIsCheckingAccessKey] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authOtp, setAuthOtp] = useState("");
  const [signupOtpRequired, setSignupOtpRequired] = useState(false);
  const [publicAccessSettings, setPublicAccessSettings] = useState<PublicAccessSettings>(defaultPublicAccessSettings);
  const [checkingPublicAccess, setCheckingPublicAccess] = useState(true);
  const [uploadedSources, setUploadedSources] = useState<UploadedSource[]>([]);
  const [sourceUploadStatus, setSourceUploadStatus] = useState("");
  const [validationErrors, setValidationErrors] = useState<FieldErrors>({});
  const [activePreviewTab, setActivePreviewTab] = useState<PreviewTab>("lesson");
  const previewPaneRef = useRef<HTMLElement | null>(null);
  const editorScrollRef = useRef<HTMLDivElement | null>(null);
  const sourceUploadRef = useRef<HTMLDivElement | null>(null);
  const gammaPollTimeoutRef = useRef<number | null>(null);
  const gammaPollStopRef = useRef(false);
  const activeGeneratorRef = useRef<PreviewTab | null>(null);

  function authHeaders(): Record<string, string> {
  const storedKey = window.sessionStorage.getItem("ilaw_access_key") || "";
  return storedKey ? { "X-ILAW-Access-Key": storedKey } : {};
}

  async function refreshApiUsage() {
    setUsageLoading(true);
    try {
      const response = await fetch("/api/openai-usage", { cache: "no-store", headers: authHeaders() });
      const usage = (await response.json()) as ApiUsage;
      setApiUsage(usage);
    } catch {
      setApiUsage({
        date: "",
        timezone: "UTC",
        configured: false,
        source: "unavailable",
        providerName: "AI API Gateway",
        usedUsd: 0,
        limitUsd: null,
        remainingUsd: null,
        percent: null,
        quotaType: "cost",
        usedCount: null,
        limitCount: null,
        remainingCount: null,
        averageCostUsd: null,
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
        requests: 0,
        message: "Unable to reach the server usage endpoint."
      });
    } finally {
      setUsageLoading(false);
    }
  }

  async function refreshPptCredits() {
    setPptCreditsLoading(true);
    try {
      const response = await fetch("/api/gamma-credits", { cache: "no-store", headers: authHeaders() });
      const credits = (await response.json()) as PptCreditState;
      setPptCredits(credits);
    } catch {
      setPptCredits({
        configured: false,
        source: "unknown",
        remaining: null,
        lastDeducted: null,
        updatedAt: null,
        message: "Unable to reach the PPT credits endpoint."
      });
    } finally {
      setPptCreditsLoading(false);
    }
  }

  function applyPptCredits(credits?: { deducted?: number; remaining?: number }) {
    if (!credits) return;

    const deducted =
      typeof credits.deducted === "number" && Number.isFinite(credits.deducted)
        ? Math.max(0, Math.floor(credits.deducted))
        : null;

    const computedRemaining =
      typeof credits.remaining === "number" && Number.isFinite(credits.remaining)
        ? Math.max(0, Math.floor(credits.remaining))
        : typeof pptCredits?.remaining === "number" && deducted !== null
          ? Math.max(0, Math.floor(pptCredits.remaining) - deducted)
          : null;

    if (computedRemaining === null) return;

    setPptCredits({
      configured: true,
      source: pptCredits?.source || "unknown",
      remaining: computedRemaining,
      lastDeducted: deducted,
      updatedAt: new Date().toISOString(),
      message: "Presentation credit balance was refreshed from the latest generation status."
    });
  }

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams(window.location.search);
    const authMessage = params.get("auth") || "";
    if (authMessage) {
      const messages: Record<string, string> = {
        pending: "Your account still needs verification before you can sign in.",
        "signup-disabled": "New account registration is currently closed. Existing users can still sign in.",
        maintenance: "The system is currently in maintenance mode. Please check the maintenance notice.",
        "google-not-configured": "Google sign-in is not configured yet. Please use email signup or ask the administrator to add Google OAuth credentials.",
        "google-failed": "Google sign-in was not completed or the Google email was not verified. Please try again or use email signup."
      };
      setAccessStatus(messages[authMessage] || "Please sign in to continue.");
      window.history.replaceState({}, "", window.location.pathname);
    }

    async function loadPublicAccessSettings() {
      try {
        const response = await fetch("/api/public-settings", { cache: "no-store" });
        const settings = (await response.json()) as PublicAccessSettings;
        if (!alive) return;
        setPublicAccessSettings({
          allowNewSignups: settings.allowNewSignups !== false,
          maintenance: {
            enabled: Boolean(settings.maintenance?.enabled),
            until: settings.maintenance?.until || "",
            message: settings.maintenance?.message || ""
          }
        });
      } catch {
        if (alive) setPublicAccessSettings(defaultPublicAccessSettings);
      } finally {
        if (alive) setCheckingPublicAccess(false);
      }
    }

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const session = (await response.json()) as { authenticated?: boolean; user?: { name?: string; email?: string } };
        if (!alive) return;
        setIsAuthenticated(Boolean(session.authenticated));
        if (session.user?.email) window.sessionStorage.setItem("ilaw_access_label", session.user.name || session.user.email);
      } catch {
        if (!alive) return;
        setIsAuthenticated(false);
      } finally {
        if (alive) setCheckingAccess(false);
      }
    }

    void loadPublicAccessSettings();
    void loadSession();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (gammaPollTimeoutRef.current) {
        window.clearTimeout(gammaPollTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      void refreshApiUsage();
      void refreshPptCredits();
    }
  }, [isAuthenticated]);

  const textCreditsRemaining = apiUsage?.configured ? apiUsage.remainingCount ?? 0 : null;
  const textCreditsLimit = apiUsage?.configured ? apiUsage.limitCount ?? null : null;
  const textCreditsLabel = usageLoading
    ? "Checking"
    : apiUsage?.configured
      ? `${formatNumber(textCreditsRemaining)} / ${formatNumber(textCreditsLimit)}`
      : "Unavailable";
  const pptCreditsLabel = pptCreditsLoading
    ? "Checking"
    : typeof pptCredits?.remaining === "number"
      ? formatNumber(pptCredits.remaining)
      : pptCredits?.configured && pptCredits.limit === null
        ? "Unlimited"
        : "Not set";
  const pptCreditsHint = typeof pptCredits?.lastDeducted === "number"
    ? `Last used ${formatNumber(pptCredits.lastDeducted)}`
    : pptCredits?.source === "custom"
      ? "Per-user PPT limit"
      : "No expiration";

  const missingRequiredFields = useMemo(
    () => requiredFieldOrder.filter((field) => validationErrors[field]).map((field) => requiredFieldLabels[field]),
    [validationErrors]
  );

  const isBusy = isGenerating || isGeneratingLAS || isGeneratingPPT;

  function beginManualGeneration(kind: PreviewTab) {
    if (activeGeneratorRef.current || isGenerating || isGeneratingLAS || isGeneratingPPT) {
      setStatusTone("error");
      setStatus("Please wait for the current generation to finish before starting another one.");
      return false;
    }
    activeGeneratorRef.current = kind;
    return true;
  }

  function finishManualGeneration(kind: PreviewTab) {
    if (activeGeneratorRef.current === kind) {
      activeGeneratorRef.current = null;
    }
  }

  function updateField(name: keyof LessonInput, value: FieldValue) {
    setForm((current) => ({
      ...current,
      [name]: value
    }));

    if (isRequiredFieldKey(name)) {
      setValidationErrors((current) => {
        if (!current[name]) return current;
        const next = { ...current };
        delete next[name];
        return next;
      });
    }
  }

  async function handleSourceFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files || []);
    const restoreScrollTop = editorScrollRef.current?.scrollTop ?? null;
    const restoreSourceTop = sourceUploadRef.current?.getBoundingClientRect().top ?? null;
    event.target.value = "";

    const restoreSourceUploadPosition = () => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (!editorScrollRef.current) return;
          if (restoreSourceTop !== null && sourceUploadRef.current) {
            const nextTop = sourceUploadRef.current.getBoundingClientRect().top;
            editorScrollRef.current.scrollTop += nextTop - restoreSourceTop;
            return;
          }
          if (restoreScrollTop !== null) {
            editorScrollRef.current.scrollTop = restoreScrollTop;
          }
        });
      });
    };

    if (!selectedFiles.length) {
      restoreSourceUploadPosition();
      return;
    }

    const existingIds = new Set(uploadedSources.map((source) => source.id));
    const availableSlots = Math.max(0, MAX_SOURCE_FILES - uploadedSources.length);
    const filesToScan: File[] = [];
    const idsToScan: string[] = [];
    const notices: string[] = [];

    if (availableSlots <= 0) {
      setSourceUploadStatus(`Limit reached: ${MAX_SOURCE_FILES} source files.`);
      restoreSourceUploadPosition();
      return;
    }

    setSourceUploadStatus("Scanning source files...");

    for (const file of selectedFiles.slice(0, availableSlots)) {
      const id = `${file.name}-${file.size}-${file.lastModified}`;

      if (existingIds.has(id)) {
        notices.push(`${file.name} is already added.`);
        continue;
      }

      if (!isSupportedSourceFile(file)) {
        notices.push(`${file.name} is not a supported source file.`);
        continue;
      }

      if (file.size > MAX_SOURCE_FILE_BYTES) {
        notices.push(`${file.name} is larger than ${formatFileSize(MAX_SOURCE_FILE_BYTES)}.`);
        continue;
      }

      filesToScan.push(file);
      idsToScan.push(id);
      existingIds.add(id);
    }

    if (selectedFiles.length > availableSlots) {
      notices.push(`Only ${availableSlots} more source file${availableSlots === 1 ? "" : "s"} can be added.`);
    }

    let accepted: UploadedSource[] = [];

    if (filesToScan.length) {
      try {
        const scanResult = await scanSourceFiles(filesToScan, idsToScan);
        notices.push(...(scanResult.notices || []));

        accepted = scanResult.sources || [];
      } catch (error) {
        notices.push(error instanceof Error ? error.message : "Unable to scan source files.");
      }
    }

    if (accepted.length) {
      setUploadedSources((current) => [...current, ...accepted]);
    }

    setSourceUploadStatus(
      [
        accepted.length ? `Added ${accepted.length} source file${accepted.length === 1 ? "" : "s"}.` : "",
        ...notices
      ].filter(Boolean).join(" ") || "No source files were added."
    );
    restoreSourceUploadPosition();
  }

  function removeUploadedSource(id: string) {
    const restoreScrollTop = editorScrollRef.current?.scrollTop ?? null;
    const restoreSourceTop = sourceUploadRef.current?.getBoundingClientRect().top ?? null;
    setUploadedSources((current) => current.filter((source) => source.id !== id));
    setSourceUploadStatus("Removed source file.");
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (!editorScrollRef.current) return;
        if (restoreSourceTop !== null && sourceUploadRef.current) {
          const nextTop = sourceUploadRef.current.getBoundingClientRect().top;
          editorScrollRef.current.scrollTop += nextTop - restoreSourceTop;
          return;
        }
        if (restoreScrollTop !== null) {
          editorScrollRef.current.scrollTop = restoreScrollTop;
        }
      });
    });
  }

  async function submitAccessKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authMode === "signup" && !publicAccessSettings.allowNewSignups) {
      setAccessStatus("New account registration is currently closed. Please sign in with an existing account or contact support.");
      return;
    }

    const email = authEmail.trim().toLowerCase();
    const password = authPassword;
    const name = authName.trim();

    if (!email) {
      setAccessStatus("Enter your school email address.");
      return;
    }
    if (authMode === "signup" && name.length < 2) {
      setAccessStatus("Enter your full name.");
      return;
    }
    if (password.length < (authMode === "signup" ? 8 : 1)) {
      setAccessStatus(authMode === "signup" ? "Use at least 8 characters for your password." : "Enter your password.");
      return;
    }
    if (authMode === "signup" && signupOtpRequired && !/^\d{6}$/.test(authOtp.trim())) {
      setAccessStatus("Enter the 6-digit verification code sent to your email.");
      return;
    }

    setIsCheckingAccessKey(true);
    setAccessStatus(authMode === "signup" ? (signupOtpRequired ? "Verifying your email..." : "Sending verification code...") : "Signing in...");
    try {
      const endpoint = authMode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, otp: authMode === "signup" && signupOtpRequired ? authOtp.trim() : "" })
      });
      const result = (await response.json()) as { ok?: boolean; message?: string; status?: string; user?: { name?: string; email?: string } };

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Unable to continue.");
      }

      if (authMode === "signup" && result.status === "otp_required") {
        setSignupOtpRequired(true);
        setAccessStatus(result.message || "Enter the verification code sent to your email.");
        return;
      }

      if (result.status === "pending") {
        setAccessStatus(result.message || "Your account still needs verification before you can sign in.");
        setAuthMode("login");
        setAuthPassword("");
        setAuthOtp("");
        setSignupOtpRequired(false);
        return;
      }

      window.sessionStorage.setItem("ilaw_access_granted", "true");
      window.sessionStorage.setItem("ilaw_access_label", result.user?.name || result.user?.email || "Authorized User");
      window.sessionStorage.removeItem("ilaw_access_key");
      setIsAuthenticated(true);
      setAccessStatus("");
      setAuthPassword("");
      setAuthOtp("");
      setSignupOtpRequired(false);
    } catch (error) {
      setAccessStatus(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setIsCheckingAccessKey(false);
    }
  }

  function startGoogleSignIn() {
    window.location.href = "/api/auth/google";
  }

  async function logoutAccessKey() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.sessionStorage.removeItem("ilaw_access_granted");
    window.sessionStorage.removeItem("ilaw_access_label");
    window.sessionStorage.removeItem("ilaw_access_key");
    setIsAuthenticated(false);
    setAccessKey("");
    setAuthPassword("");
    setAuthOtp("");
    setSignupOtpRequired(false);
  }

  function buildLessonPayload(): LessonInput {
    const sourceMaterials = buildSourceMaterials(uploadedSources);
    const sourceReferences = buildSourceReferences(uploadedSources);
    const payload: LessonInput = {
      ...form,
      inputMode: "manual",
      sessionCount: Number(form.sessionCount || 5),
      sessionDurationMinutes: Number(form.sessionDurationMinutes || 60),
      references: sourceReferences ? sourceReferences : "",
      sourceMaterials,
      curriculumStandards: `Content Standard:\n${form.contentStandard.trim()}\n\nPerformance Standard:\n${form.performanceStandard.trim()}`
    };

    const grade = (form.gradeLevelSection || "").trim();
    const section = (form.school || "").trim();
    payload.gradeLevelSection = grade && section ? `${grade} - ${section}` : grade || section;

    return payload;
  }

  function syncFormSettings() {
    setForm((current) => ({
      ...current,
      inputMode: "manual",
      sessionCount: Number(form.sessionCount || 5),
      sessionDurationMinutes: Number(form.sessionDurationMinutes || 60),
      outputDepth: form.outputDepth || "Detailed",
      pptTheme: form.pptTheme || "Basic Light",
      pptPageCount: Number(form.pptPageCount || 20),
      pptImageModel: form.pptImageModel || "imagen-4-fast",
      pptImageStylePreset: form.pptImageStylePreset || "3D"
    }));
  }

  async function generateDocx() {
    setStatus("");
    setStatusTone("success");

    if (!beginManualGeneration("lesson")) return;

    const errors = validateLessonForm(form);
    setValidationErrors(errors);

    if (Object.keys(errors).length) {
      setStatusTone("error");
      setStatus("Complete the required lesson details before generating the Lesson Plan.");
      finishManualGeneration("lesson");
      return;
    }

    setActivePreviewTab("lesson");
    setShowPreview(false);
    setGeneratedLesson(null);
    setGeneratedLasBlob(null);
    setGeneratedLasFilename("");
    setGeneratedPptExportUrl("");
    setGeneratedPptGammaUrl("");
    setPendingGammaGenerationId("");
    gammaPollStopRef.current = true;
    clearGammaPollTimer();
    setIsAutoPollingPPT(false);

    setIsGenerating(true);
    window.requestAnimationFrame(() => {
      previewPaneRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    try {
      const payload = buildLessonPayload();
      syncFormSettings();

      const response = await fetch("/api/generate?response=json", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || "Generation failed.");
      }

      const body = (await response.json()) as {
        filename: string;
        contentType: string;
        docxBase64: string;
        lesson: GeneratedLesson;
        model: string;
        usedAI: boolean;
      };
      const blob = base64ToBlob(body.docxBase64, body.contentType);
      const filename = body.filename || "ILAW-Weekly-Lesson-Plan.docx";

      setGeneratedBlob(blob);
      setGeneratedFilename(filename);
      setGeneratedLesson(body.lesson);
      setShowPreview(true);
      if (body.usedAI) {
        void refreshApiUsage();
      }

      setStatus("Lesson plan generated. You can now generate the LAS or PPT from the same lesson flow.");
    } catch (error) {
      setStatusTone("error");
      setStatus(generationErrorMessage(error));
    } finally {
      setIsGenerating(false);
      finishManualGeneration("lesson");
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  async function generateLASDocx() {
    setStatus("");
    setStatusTone("success");
    setActivePreviewTab("activity");

    if (!generatedLesson) {
      setStatusTone("error");
      setStatus("Step required: generate the Lesson Plan first before creating Activity Sheets.");
      return;
    }

    if (!beginManualGeneration("activity")) return;

    setActivePreviewTab("activity");
    window.requestAnimationFrame(() => {
      previewPaneRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    setStatus("AI is preparing the Activity Sheets. The download link will appear in the Activity Sheet Preview tab.");
    setIsGeneratingLAS(true);
    try {
      const payload = buildLessonPayload();
      const response = await fetch("/api/generate-las", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ ...payload, lesson: generatedLesson })
      });

      const body = (await response.json()) as {
        filename?: string;
        contentType?: string;
        docxBase64?: string;
        error?: string;
      };

      if (!response.ok || !body.docxBase64 || !body.contentType) {
        throw new Error(body.error || "LAS generation failed.");
      }

      const filename = body.filename || "Generated-LAS.docx";
      const blob = base64ToBlob(body.docxBase64, body.contentType);
      setGeneratedLasBlob(blob);
      setGeneratedLasFilename(filename);
      void refreshApiUsage();
      setStatus(`Activity Sheets are ready. Download ${filename} from the Activity Sheet Preview tab.`);
    } catch (error) {
      setStatusTone("error");
      setStatus(generationErrorMessage(error));
    } finally {
      setIsGeneratingLAS(false);
      finishManualGeneration("activity");
    }
  }

  function clearGammaPollTimer() {
    if (gammaPollTimeoutRef.current) {
      window.clearTimeout(gammaPollTimeoutRef.current);
      gammaPollTimeoutRef.current = null;
    }
  }

  function scheduleGammaPPTStatusPoll(generationId: string) {
    if (!generationId || gammaPollStopRef.current) return;
    clearGammaPollTimer();
    setIsAutoPollingPPT(true);
    gammaPollTimeoutRef.current = window.setTimeout(() => {
      void checkGammaPPTStatus(generationId, true);
    }, GAMMA_CLIENT_POLL_INTERVAL_MS);
  }

  function stopGammaAutoPolling() {
    gammaPollStopRef.current = true;
    clearGammaPollTimer();
    setIsAutoPollingPPT(false);
    setStatusTone("success");
    setStatus("Automatic PPT checking stopped. You can click Check PPT Status anytime to resume.");
  }

  function applyGammaPptResult(body: GammaPptResponse, continueAutoPolling = true) {
    setGeneratedPptExportUrl(body.exportUrl || "");
    setGeneratedPptGammaUrl(body.gammaUrl || "");
    applyPptCredits(body.credits);
    void refreshPptCredits();

    if (body.exportUrl) {
      gammaPollStopRef.current = true;
      clearGammaPollTimer();
      setIsAutoPollingPPT(false);
      setPendingGammaGenerationId("");
      setActivePreviewTab("presentation");
      setStatus("Presentation is ready. Use the Presentation Preview tab to download the PPTX file.");
      return;
    }

    const generationId = body.generationId || pendingGammaGenerationId;
    setPendingGammaGenerationId(generationId);
    setStatusTone("success");
    setStatus(
      body.message?.replace(/Gamma/gi, "AI") ||
        "AI is still preparing the PPT deck. The app will keep checking automatically until the download link is ready."
    );

    if (continueAutoPolling && generationId) {
      scheduleGammaPPTStatusPoll(generationId);
    }
  }

  async function checkGammaPPTStatus(generationIdOverride?: string, isAutomatic = false) {
    const generationId = generationIdOverride || pendingGammaGenerationId;
    if (!generationId) return;

    if (!isAutomatic) {
      gammaPollStopRef.current = false;
      setIsAutoPollingPPT(true);
      setStatusTone("success");
      setStatus("Checking PPT generation status...");
      setIsGeneratingPPT(true);
    }

    try {
      const response = await fetch(`/api/gamma-status?generationId=${encodeURIComponent(generationId)}`, {
        method: "GET",
        cache: "no-store",
        headers: authHeaders()
      });
      const body = (await response.json()) as GammaPptResponse;

      if (!response.ok) {
        throw new Error(body.error || "Unable to check PPT status.");
      }

      applyGammaPptResult({ ...body, generationId: body.generationId || generationId }, true);
    } catch (error) {
      clearGammaPollTimer();
      setIsAutoPollingPPT(false);
      setStatusTone("error");
      setStatus(generationErrorMessage(error));
    } finally {
      if (!isAutomatic) {
        setIsGeneratingPPT(false);
      }
    }
  }

  async function generatePPTWithGamma() {
    setStatus("");
    setStatusTone("success");
    setActivePreviewTab("presentation");
    setGeneratedPptExportUrl("");
    setGeneratedPptGammaUrl("");
    setPendingGammaGenerationId("");
    gammaPollStopRef.current = false;
    clearGammaPollTimer();
    setIsAutoPollingPPT(false);

    if (!generatedLesson) {
      setStatusTone("error");
      setStatus("Step required: generate the Lesson Plan first before creating the Presentation.");
      return;
    }

    if (!beginManualGeneration("presentation")) return;

    window.requestAnimationFrame(() => {
      previewPaneRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    setStatus("AI is designing the Presentation. The download link will appear in the Presentation Preview tab.");
    setIsGeneratingPPT(true);
    try {
      const payload = buildLessonPayload();
      const response = await fetch("/api/generate-ppt", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ ...payload, lesson: generatedLesson })
      });
      const body = (await response.json()) as GammaPptResponse;

      if (!response.ok) {
        throw new Error(body.error || "PPT generation failed.");
      }

      applyGammaPptResult(body, true);
    } catch (error) {
      clearGammaPollTimer();
      setIsAutoPollingPPT(false);
      setStatusTone("error");
      setStatus(generationErrorMessage(error));
    } finally {
      setIsGeneratingPPT(false);
      finishManualGeneration("presentation");
    }
  }

  function downloadGenerated() {
    if (!generatedBlob) return;
    downloadBlob(generatedBlob, generatedFilename);
    setStatusTone("success");
    setStatus(`Downloaded ${generatedFilename}.`);
  }

  function downloadGeneratedLAS() {
    if (!generatedLasBlob) return;
    downloadBlob(generatedLasBlob, generatedLasFilename);
    setStatusTone("success");
    setStatus(`Downloaded ${generatedLasFilename}.`);
  }

  function printPreview() {
    window.print();
  }

  async function copyPreview() {
    const text = generatedLesson
      ? [
          "LESSON PLAN TEMPLATE",
          `Lesson Title: ${generatedLesson.title}`,
          `Learning Area/s: ${generatedLesson.learningArea}`,
          `Teacher/s: ${generatedLesson.teacherName}`,
          `Grade Level and Section: ${generatedLesson.gradeLevelSection}`,
          `Teaching Dates: ${generatedLesson.teachingDates || form.teachingDates}`,
          `No. of Sessions: ${generatedLesson.sessions.length || form.sessionCount}`,
          `Duration of Each Session: ${form.sessionDurationMinutes || 60} minutes`,
          `References: ${generatedLesson.references}`,
          `Learning Competency: ${generatedLesson.learningCompetency}`,
          `Content Standard: ${generatedLesson.contentStandard || form.contentStandard}`,
          `Performance Standard: ${generatedLesson.performanceStandard || form.performanceStandard}`,
          `Learner Context: ${generatedLesson.learnerContext}`,
          "",
          ...generatedLesson.sessions.map(
            (session) =>
              `${formatSessionHeaderLabel(session.label, form.sessionDurationMinutes)}: By the end of ${session.label}, learners will be able to: ${session.learningObjectives
                .map((objective) => cleanObjectiveText(objective, session.sessionNumber))
                .join("; ")}`
          )
        ].join("\n")
      : [
          "LESSON PLAN TEMPLATE",
          `Lesson Title: ${form.lessonTitle}`,
          `Learning Area/s: ${form.learningArea}`,
          `Teacher/s: ${form.teacherName}`,
          `Grade Level and Section: ${form.gradeLevelSection}`,
          `Teaching Dates: ${form.teachingDates}`,
          `No. of Sessions: ${form.sessionCount}`,
          `Duration of Each Session: ${form.sessionDurationMinutes || 60} minutes`,
          `References: ${form.references}`,
          `Learning Competency: ${form.learningCompetency}`,
          `Content Standard: ${form.contentStandard}`,
          `Performance Standard: ${form.performanceStandard}`,
          `Learner Context: ${form.learnerContext}`
        ].join("\n");

    await navigator.clipboard.writeText(text);
    setStatusTone("success");
    setStatus("Preview summary copied.");
  }

  if (checkingAccess || checkingPublicAccess) {
    return (
      <main className="landing-shell">
        <div className="landing-loading">
          <Loader2 className="spin" size={24} />
          Preparing Classroom Design Suite...
        </div>
      </main>
    );
  }

  if (!isAuthenticated && publicAccessSettings.maintenance.enabled) {
    return <MaintenancePage maintenance={publicAccessSettings.maintenance} />;
  }

  if (!isAuthenticated) {
    return (
      <LandingPage
        authMode={authMode}
        accessStatus={accessStatus}
        isChecking={isCheckingAccessKey}
        name={authName}
        email={authEmail}
        password={authPassword}
        otp={authOtp}
        otpRequired={signupOtpRequired}
        onModeChange={(mode) => { setAuthMode(mode); setSignupOtpRequired(false); setAuthOtp(""); setAccessStatus(""); }}
        onNameChange={setAuthName}
        onEmailChange={(value) => { setAuthEmail(value); setSignupOtpRequired(false); setAuthOtp(""); }}
        onPasswordChange={setAuthPassword}
        onOtpChange={setAuthOtp}
        onSubmit={submitAccessKey}
        onGoogleSignIn={startGoogleSignIn}
        allowNewSignups={publicAccessSettings.allowNewSignups}
      />
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">
          <GraduationCap size={32} />
        </div>
        <div className="brand-lockup">
          <h1>Classroom Design Suite</h1>
          <p>ILAW Framework · Lesson Plan · LAS · PPT workspace</p>
        </div>
        <div className="topbar-actions" aria-label="System credits and account actions">
          <button
            type="button"
            className="header-credit-card text-credit-card"
            onClick={refreshApiUsage}
            disabled={usageLoading}
            title="Refresh Lesson Plan and Activity Sheets daily text credits"
          >
            <span>Lesson / LAS</span>
            <strong>{textCreditsLabel}</strong>
            <small>Credits · resets daily</small>
          </button>

          <button
            type="button"
            className="header-credit-card ppt-credit-card"
            onClick={refreshPptCredits}
            disabled={pptCreditsLoading}
            title="Refresh PPT Generator credits"
          >
            <span>PPT Generator</span>
            <strong>{pptCreditsLabel}</strong>
            <small>Credits · {pptCreditsHint}</small>
          </button>

          <button type="button" className="logout-button" onClick={logoutAccessKey}>
            Sign out
          </button>
        </div>
      </header>

      <div className="workspace">
        <form className="editor-pane" onSubmit={(event) => event.preventDefault()} noValidate>
          <div className="panel-title">
            <FileText size={18} />
            <h2>Lesson Workspace</h2>
          </div>

          <div className="editor-scroll" ref={editorScrollRef}>
          <div className="form-wrap">
            <section className="form-section manual-generator-form">
              <div className="manual-form-title">
                <span className="generator-eyebrow"><Sparkles size={14} /> Lesson Plan Generator</span>
                <h3>Build the ILAW Lesson Plan</h3>
                <p>Complete the required lesson details, curriculum standards, and optional references. The generated lesson becomes the source for LAS and PPT outputs.</p>
              </div>

              <div className="form-step-grid">
                <section className="form-card">
                  <div className="form-card-header">
                    <span className="step-pill">Step 1</span>
                    <div>
                      <h3 className="section-heading">
                        <LayoutTemplate size={16} /> Lesson Information
                      </h3>
                      <p>Set the class, topic, schedule, and number of sessions for the week.</p>
                    </div>
                  </div>

                  <div className="field-spacer">
                    <div className="grid-two compact-pair">
                      <Select
                        label="Language"
                        value={form.language}
                        onChange={(value) => updateField("language", value)}
                        options={languageOptions}
                      />
                      <GroupedSelect
                        label="Grade Level"
                        required
                        value={form.gradeLevelSection}
                        onChange={(value) => updateField("gradeLevelSection", value)}
                        groups={gradeLevelGroups}
                        placeholder="Select grade level"
                        error={validationErrors.gradeLevelSection}
                      />
                    </div>

                    <GroupedSelect
                      label="Learning Area / Subject"
                      required
                      value={subjectSelectValue(form.learningArea)}
                      onChange={(value) => updateField("learningArea", subjectValueFromChoice(value))}
                      groups={subjectGroups}
                      placeholder="Select subject"
                      error={validationErrors.learningArea}
                    />
                    {isOtherSubjectSelected(form.learningArea) ? (
                      <TextField
                        label="Other Learning Area / Subject"
                        value={customSubjectValue(form.learningArea)}
                        onChange={(value) => updateField("learningArea", value.trim() ? value : "Others (SHS)")}
                        placeholder="e.g. Empowerment Technologies, Research 1, Creative Writing"
                      />
                    ) : null}

                    <TextField
                      label="Topic / Lesson (optional)"
                      value={form.lessonTitle}
                      onChange={(value) => updateField("lessonTitle", value)}
                      placeholder="Optional; AI can infer this from the learning competency"
                    />

                    <div className="grid-two compact-pair">
                      <Select
                        label="Quarter / Term"
                        required
                        value={form.term}
                        onChange={(value) => updateField("term", value)}
                        options={termOptions}
                        placeholder="Term"
                        error={validationErrors.term}
                      />
                      <Select
                        label="Week"
                        required
                        value={form.week}
                        onChange={(value) => updateField("week", value)}
                        options={weekOptions}
                        placeholder="Week"
                        error={validationErrors.week}
                      />
                    </div>

                    <div className="grid-two compact-pair">
                      <TextField
                        label="Teaching Dates"
                        required
                        value={form.teachingDates}
                        onChange={(value) => updateField("teachingDates", value)}
                        placeholder="e.g. June 22-26, 2026"
                        error={validationErrors.teachingDates}
                      />
                      <Select
                        label="Number of Sessions"
                        required
                        value={String(form.sessionCount || 5)}
                        onChange={(value) => updateField("sessionCount", Number(value))}
                        options={sessionOptions}
                        placeholder="Select sessions"
                      />
                    </div>

                    <div className="grid-two compact-pair duration-detail-row">
                      <div className={`field ${validationErrors.sessionDurationMinutes ? "has-error" : ""}`}>
                        <label htmlFor="session-duration-minutes">Duration (minutes) *</label>
                        <input
                          id="session-duration-minutes"
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          required
                          value={form.sessionDurationMinutes || ""}
                          onChange={(event) =>
                            updateField(
                              "sessionDurationMinutes",
                              event.target.value ? Number(event.target.value.replace(/\D/g, "")) : 0
                            )
                          }
                          placeholder="e.g. 45"
                          aria-invalid={Boolean(validationErrors.sessionDurationMinutes)}
                          aria-describedby={validationErrors.sessionDurationMinutes ? "session-duration-error" : undefined}
                        />
                        {validationErrors.sessionDurationMinutes ? (
                          <p className="field-error-text" id="session-duration-error">
                            {validationErrors.sessionDurationMinutes}
                          </p>
                        ) : null}
                      </div>
                      <Select
                        label="Output Detail"
                        value={form.outputDepth || "Detailed"}
                        onChange={(value) => updateField("outputDepth", value)}
                        options={outputDepthOptions}
                      />
                    </div>

                    <div className="coverage-note">
                      <CheckCircle2 size={16} />
                      <span>Session count controls pacing only. All weekly competencies pasted below will be covered and divided across the selected sessions.</span>
                    </div>
                  </div>
                </section>

                <section className="form-card emphasis-card">
                  <div className="form-card-header">
                    <span className="step-pill">Step 2</span>
                    <div>
                      <h3 className="section-heading">
                        <GraduationCap size={16} /> Curriculum Information
                      </h3>
                      <p>Paste the official competency and standards exactly as provided in your curriculum guide.</p>
                    </div>
                  </div>

                  <div className="field-spacer">
                    <TextArea
                      label="Learning Competency"
                      required
                      value={form.learningCompetency}
                      onChange={(value) => updateField("learningCompetency", value)}
                      placeholder="Paste the exact MELC or learning competency here. Add all weekly competencies if there are multiple."
                      warning="Paste all competencies budgeted for the week. If fewer sessions are selected, the system clusters them without dropping any competency."
                      error={validationErrors.learningCompetency}
                    />
                    <TextArea
                      label="Content Standard"
                      required
                      value={form.contentStandard}
                      onChange={(value) => updateField("contentStandard", value)}
                      placeholder="Paste the content standard here."
                      error={validationErrors.contentStandard}
                    />
                    <TextArea
                      label="Performance Standard"
                      required
                      value={form.performanceStandard}
                      onChange={(value) => updateField("performanceStandard", value)}
                      placeholder="Paste the performance standard here."
                      error={validationErrors.performanceStandard}
                    />

                    <div className="source-upload" ref={sourceUploadRef}>
                      <div className="source-upload-header">
                        <div>
                          <label htmlFor="source-file-upload">Source files (optional)</label>
                          <p>Scanner supports PDF, DOCX, Text, Markdown, CSV, JSON, HTML, RTF, or XML. Up to 5 files.</p>
                        </div>
                        <span>{uploadedSources.length}/{MAX_SOURCE_FILES}</span>
                      </div>
                      <label className="source-upload-target" htmlFor="source-file-upload">
                        <UploadCloud size={18} />
                        <span>Choose source files to scan</span>
                      </label>
                      <input
                        id="source-file-upload"
                        className="source-file-input"
                        type="file"
                        multiple
                        accept={sourceFileAccept}
                        onChange={handleSourceFileChange}
                        disabled={uploadedSources.length >= MAX_SOURCE_FILES || isBusy}
                      />
                      {uploadedSources.length ? (
                        <ul className="source-list">
                          {uploadedSources.map((source) => (
                            <li key={source.id}>
                              <FileText size={15} />
                              <span>{source.name}</span>
                              <small>{formatFileSize(source.size)}</small>
                              <button
                                type="button"
                                title={`Remove ${source.name}`}
                                onClick={() => removeUploadedSource(source.id)}
                                disabled={isBusy}
                              >
                                <Trash2 size={14} />
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {sourceUploadStatus ? <p className="field-help">{sourceUploadStatus}</p> : null}
                    </div>
                  </div>
                </section>

                <details className="form-card optional-card" open>
                  <summary className="form-card-header optional-summary">
                    <span className="step-pill">Step 3</span>
                    <div>
                      <h3 className="section-heading">
                        <ShieldCheck size={16} /> Document Settings
                      </h3>
                      <p>Add teacher/checker details and choose document page settings.</p>
                    </div>
                  </summary>

                  <div className="field-spacer optional-fields">
                    <div className="grid-two compact-pair">
                      <TextField
                        label="Teacher Name"
                        value={form.teacherName}
                        onChange={(value) => updateField("teacherName", value)}
                        placeholder="e.g. Mike Constantino"
                      />
                      <TextField
                        label="Teacher Role"
                        value={form.teacherRole}
                        onChange={(value) => updateField("teacherRole", value)}
                        placeholder="e.g. Subject Teacher"
                      />
                    </div>
                    <div className="grid-two compact-pair">
                      <TextField
                        label="Checked By"
                        value={form.checkedBy}
                        onChange={(value) => updateField("checkedBy", value)}
                        placeholder="e.g. Department Head"
                      />
                      <TextField
                        label="Checker Role"
                        value={form.checkerRole}
                        onChange={(value) => updateField("checkerRole", value)}
                        placeholder="e.g. Master Teacher / Head Teacher"
                      />
                    </div>
                    <div className="grid-two compact-pair">
                      <TextField
                        label="Section / Class"
                        value={form.school}
                        onChange={(value) => updateField("school", value)}
                        placeholder="e.g. Sampaguita"
                      />
                      <TextField
                        label="School Year"
                        value={form.schoolYear}
                        onChange={(value) => updateField("schoolYear", value)}
                        placeholder="2026-2027"
                      />
                    </div>
                    <div className="grid-two compact-pair">
                      <Select
                        label="Paper Size"
                        value={form.paperSize}
                        onChange={(value) => updateField("paperSize", value)}
                        options={paperSizeOptions}
                      />
                      <Select
                        label="Orientation"
                        value={form.pageOrientation}
                        onChange={(value) => updateField("pageOrientation", value)}
                        options={orientationOptions}
                      />
                    </div>
                    <div className="presentation-settings-panel output-settings-row">
                      <div className="settings-section-title">
                        <Sparkles size={16} />
                        <div>
                          <strong>Presentation Visual Settings</strong>
                          <span>Choose the deck theme, slide count, AI image model, and art style for the presentation.</span>
                        </div>
                      </div>

                      <div className="grid-two compact-pair presentation-dropdown-row">
                        <Select
                          label="Presentation Slides"
                          value={String(form.pptPageCount || 20)}
                          onChange={(value) => updateField("pptPageCount", Number(value))}
                          options={pptPageCountOptions}
                        />
                        <Select
                          label="AI Image Source / Model"
                          value={form.pptImageModel || "imagen-4-fast"}
                          onChange={(value) => updateField("pptImageModel", value)}
                          options={pptImageModelOptions}
                        />
                      </div>

                      <ThemePicker
                        label="Presentation Theme"
                        value={form.pptTheme || "Basic Light"}
                        onChange={(value) => updateField("pptTheme", value)}
                        options={pptThemeOptions}
                        collapsedLabel="Show more themes"
                      />

                      <ThemePicker
                        label="AI Image Type / Style"
                        value={form.pptImageStylePreset || "3D"}
                        onChange={(value) => updateField("pptImageStylePreset", value)}
                        options={pptImageStyleOptions}
                        className="image-style-picker"
                        collapsedLabel="Show more styles"
                      />
                    </div>

                  </div>
                </details>
              </div>
            </section>
          </div>

          {status ? <p className={`status-line ${statusTone === "error" ? "error" : ""}`}>{status}</p> : null}
          {missingRequiredFields.length > 0 && !isBusy ? (
            <p className="generate-hint">
              Fill in required fields: {missingRequiredFields.join(", ")}.
            </p>
          ) : null}


          </div>

          <div className="actions generation-command-bar">
            <div className="generation-action-row">
              <button
                type="button"
                className="reset-compact-button"
                title="Reset workspace"
                onClick={() => {
                  setForm(defaultInput);
                  setStatus("");
                  setStatusTone("success");
                  setShowPreview(false);
                  setGeneratedBlob(null);
                  setGeneratedLesson(null);
                  setGeneratedLasBlob(null);
                  setGeneratedLasFilename("");
                  setGeneratedPptExportUrl("");
                  setGeneratedPptGammaUrl("");
                  setPendingGammaGenerationId("");
                  setActivePreviewTab("lesson");
                  gammaPollStopRef.current = true;
                  clearGammaPollTimer();
                  setIsAutoPollingPPT(false);
                  setUploadedSources([]);
                  setSourceUploadStatus("");
                  setValidationErrors({});
                }}
              >
                <RotateCcw size={18} />
              </button>

              <div className="generation-button-grid" aria-label="Document generators">
                <button
                  type="button"
                  className="generation-choice-button lesson-plan-button"
                  disabled={isBusy}
                  title="Generate lesson plan"
                  onClick={() => {
                    setActivePreviewTab("lesson");
                    void generateDocx();
                  }}
                >
                  <Eye size={18} />
                  <span>Lesson Plan</span>
                </button>

                <button
                  type="button"
                  className="generation-choice-button activity-sheets-button"
                  disabled={isBusy}
                  title={generatedLesson ? "Generate activity sheets from the generated lesson plan" : "Generate the Lesson Plan first"}
                  onClick={generateLASDocx}
                >
                  <Clipboard size={18} />
                  <span>Activity Sheets</span>
                </button>

                <button
                  type="button"
                  className="generation-choice-button presentation-button"
                  disabled={isBusy}
                  title={generatedLesson ? "Generate presentation from the generated lesson plan" : "Generate the Lesson Plan first"}
                  onClick={generatePPTWithGamma}
                >
                  <Sparkles size={18} />
                  <span>Presentation</span>
                </button>
              </div>
            </div>
          </div>
        </form>

        <section ref={previewPaneRef} className="preview-pane" aria-label="Document preview workspace">
          <div className="preview-shell-header">
            <div className="preview-heading-row">
              <div className="panel-title compact">
                <Eye size={18} />
                <h2>Document Preview</h2>
              </div>
              <div className="preview-actions">
                {activePreviewTab === "lesson" && generatedLesson && generatedBlob ? (
                  <>
                    <button type="button" className="ghost-button" onClick={downloadGenerated}>
                      <Download size={16} /> Download
                    </button>
                    <button type="button" className="ghost-button" onClick={printPreview}>
                      <Printer size={16} /> Print
                    </button>
                    <button type="button" className="ghost-button" onClick={copyPreview}>
                      <Clipboard size={16} /> Copy
                    </button>
                  </>
                ) : null}

                {activePreviewTab === "activity" && generatedLasBlob ? (
                  <button type="button" className="ghost-button" onClick={downloadGeneratedLAS}>
                    <Download size={16} /> Download Activity Sheets
                  </button>
                ) : null}

                {activePreviewTab === "presentation" && generatedPptExportUrl ? (
                  <a className="ghost-button link-button" href={generatedPptExportUrl} target="_blank" rel="noreferrer">
                    <Download size={16} /> Download Presentation
                  </a>
                ) : null}

                {activePreviewTab === "presentation" && pendingGammaGenerationId && !generatedPptExportUrl ? (
                  <>
                    <button type="button" className="ghost-button" onClick={() => checkGammaPPTStatus()} disabled={isGeneratingPPT}>
                      {isGeneratingPPT ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />} Check Status
                    </button>
                    {isAutoPollingPPT ? (
                      <button type="button" className="ghost-button" onClick={stopGammaAutoPolling}>
                        <X size={16} /> Stop
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>

            <div className="preview-tabs" role="tablist" aria-label="Generated document previews">
              <button
                type="button"
                role="tab"
                aria-selected={activePreviewTab === "lesson"}
                className={`preview-tab-button ${activePreviewTab === "lesson" ? "active" : ""}`}
                onClick={() => setActivePreviewTab("lesson")}
              >
                <FileText size={16} />
                <span>Lesson Plan Preview</span>
                <em className={isGenerating ? "tab-state generating" : generatedLesson ? "tab-state ready" : "tab-state"}>
                  {isGenerating ? "Generating" : generatedLesson ? "Ready" : "Waiting"}
                </em>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activePreviewTab === "activity"}
                className={`preview-tab-button ${activePreviewTab === "activity" ? "active" : ""}`}
                onClick={() => setActivePreviewTab("activity")}
              >
                <Clipboard size={16} />
                <span>Activity Sheet Preview</span>
                <em className={isGeneratingLAS ? "tab-state generating" : generatedLasBlob ? "tab-state ready" : "tab-state"}>
                  {isGeneratingLAS ? "Generating" : generatedLasBlob ? "Ready" : "Waiting"}
                </em>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activePreviewTab === "presentation"}
                className={`preview-tab-button ${activePreviewTab === "presentation" ? "active" : ""}`}
                onClick={() => setActivePreviewTab("presentation")}
              >
                <Sparkles size={16} />
                <span>Presentation Preview</span>
                <em className={(isGeneratingPPT || (pendingGammaGenerationId && !generatedPptExportUrl)) ? "tab-state generating" : generatedPptExportUrl ? "tab-state ready" : "tab-state"}>
                  {(isGeneratingPPT || (pendingGammaGenerationId && !generatedPptExportUrl)) ? "Generating" : generatedPptExportUrl ? "Ready" : "Waiting"}
                </em>
              </button>
            </div>
          </div>

          <div className="preview-tab-body">
            {activePreviewTab === "lesson" ? (
              isGenerating ? (
                <GeneratingPanel
                  title="AI is generating your lesson plan"
                  message={status || "Building the lesson structure, session columns, assessments, resources, and ways forward."}
                  steps={["Preparing lesson details", "Reading form inputs", "AI is generating it", "Formatting DOCX output"]}
                />
              ) : generatedLesson ? (
                <Preview form={form} lesson={generatedLesson} />
              ) : (
                <PreviewPlaceholder
                  icon={<FileText size={48} strokeWidth={1} />}
                  title="Lesson Plan Preview"
                  message="Complete the required lesson details and click the Lesson Plan button. The preview and download action will appear here."
                />
              )
            ) : null}

            {activePreviewTab === "activity" ? (
              isGeneratingLAS ? (
                <GeneratingPanel
                  title="AI is generating activity sheets"
                  message="Creating learner tasks, classroom prompts, assessment items, and printable DOCX formatting."
                  steps={["Reading lesson plan", "Building activities", "Preparing DOCX", "Creating download link"]}
                />
              ) : generatedLasBlob ? (
                <OutputReadyCard
                  eyebrow="Activity Sheet Preview"
                  title="Activity Sheets are ready"
                  message="The learner activity sheet has been generated from the approved lesson plan. Download the DOCX file below."
                  filename={generatedLasFilename}
                >
                  <button type="button" className="primary-download-button activity-download" onClick={downloadGeneratedLAS}>
                    <Download size={18} /> Download Activity Sheets
                  </button>
                </OutputReadyCard>
              ) : (
                <PreviewPlaceholder
                  icon={<Clipboard size={48} strokeWidth={1} />}
                  title="Activity Sheet Preview"
                  message={generatedLesson ? "Click the Activity Sheets button to generate the LAS from the completed lesson plan." : "Generate the Lesson Plan first. Activity Sheets will use the approved lesson content as their source."}
                />
              )
            ) : null}

            {activePreviewTab === "presentation" ? (
              isGeneratingPPT || (pendingGammaGenerationId && !generatedPptExportUrl && isAutoPollingPPT) ? (
                <GeneratingPanel
                  title="AI is generating the presentation"
                  message="Designing the slide sequence, teacher prompts, and export-ready PowerPoint content."
                  steps={["Planning slides", "Designing content", "Preparing PPTX", "Creating download link"]}
                />
              ) : generatedPptExportUrl ? (
                <OutputReadyCard
                  eyebrow="Presentation Preview"
                  title="Presentation is ready"
                  message="The PowerPoint presentation has been prepared. Use the download link below to open or save the PPTX file."
                  filename="Export-ready PPTX presentation"
                >
                  <a className="primary-download-button presentation-download" href={generatedPptExportUrl} target="_blank" rel="noreferrer">
                    <Download size={18} /> Download Presentation
                  </a>

                </OutputReadyCard>
              ) : pendingGammaGenerationId ? (
                <OutputReadyCard
                  eyebrow="Presentation Preview"
                  title="Presentation is still being prepared"
                  message="The request has been sent. Click Check Status to refresh the result and show the download link here once it is ready."
                  filename="PowerPoint generation in progress"
                >
                  <button type="button" className="primary-download-button presentation-download" onClick={() => checkGammaPPTStatus()} disabled={isGeneratingPPT}>
                    {isGeneratingPPT ? <Loader2 size={18} className="spin" /> : <Sparkles size={18} />} Check Status
                  </button>
                </OutputReadyCard>
              ) : (
                <PreviewPlaceholder
                  icon={<Sparkles size={48} strokeWidth={1} />}
                  title="Presentation Preview"
                  message={generatedLesson ? "Choose the presentation theme and slide count, then click the Presentation button. The download link will appear here." : "Generate the Lesson Plan first. The Presentation will use the approved lesson content as its source."}
                />
              )
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function formatMaintenanceTime(value: string) {
  if (!value) return "We will be back soon.";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

type SupportContactFormProps = {
  variant?: "landing" | "maintenance";
  defaultName?: string;
  defaultEmail?: string;
  defaultSubject?: string;
};

type ContactSupportToggleProps = SupportContactFormProps & {
  buttonLabel?: string;
  helperText?: string;
};

function ContactSupportToggle({
  variant = "landing",
  defaultName = "",
  defaultEmail = "",
  defaultSubject = "Support request",
  buttonLabel = "Contact support",
  helperText = "Open the form only when you need to send a message."
}: ContactSupportToggleProps) {
  const [isOpen, setOpen] = useState(false);

  return (
    <div className={`support-toggle support-toggle-${variant}`}>
      <button type="button" className="support-toggle-button" onClick={() => setOpen((value) => !value)} aria-expanded={isOpen}>
        <Mail size={18} />
        <span>{isOpen ? "Hide support form" : buttonLabel}</span>
        <ArrowRight size={16} className={isOpen ? "support-toggle-arrow open" : "support-toggle-arrow"} />
      </button>
      {!isOpen && helperText ? <p>{helperText}</p> : null}
      {isOpen ? (
        <SupportContactForm
          variant={variant}
          defaultName={defaultName}
          defaultEmail={defaultEmail}
          defaultSubject={defaultSubject}
        />
      ) : null}
    </div>
  );
}

function SupportContactForm({ variant = "landing", defaultName = "", defaultEmail = "", defaultSubject = "Support request" }: SupportContactFormProps) {
  const [supportName, setSupportName] = useState(defaultName);
  const [supportEmail, setSupportEmail] = useState(defaultEmail);
  const [supportSubject, setSupportSubject] = useState(defaultSubject);
  const [supportMessage, setSupportMessage] = useState("");
  const [supportStatus, setSupportStatus] = useState("");
  const [isSendingSupport, setSendingSupport] = useState(false);

  async function submitSupport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSendingSupport(true);
    setSupportStatus("Sending your message...");
    try {
      const response = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: supportName,
          email: supportEmail,
          subject: supportSubject,
          message: supportMessage,
          page: typeof window !== "undefined" ? window.location.href : ""
        })
      });
      const result = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok || !result.ok) throw new Error(result.message || "Unable to send support message.");
      setSupportStatus(result.message || "Message sent. Support will contact you soon.");
      setSupportMessage("");
    } catch (error) {
      setSupportStatus(error instanceof Error ? error.message : "Unable to send support message.");
    } finally {
      setSendingSupport(false);
    }
  }

  return (
    <form className={`support-form ${variant === "maintenance" ? "support-form-maintenance" : ""}`} onSubmit={submitSupport}>
      <div className="support-form-heading">
        <span><Mail size={18} /></span>
        <div>
          <strong>Contact support</strong>
          <small>Send a message directly from the app.</small>
        </div>
      </div>
      <div className="support-form-grid">
        <label>Name<input value={supportName} onChange={(event) => setSupportName(event.target.value)} placeholder="Your name" autoComplete="name" /></label>
        <label>Email<input type="email" value={supportEmail} onChange={(event) => setSupportEmail(event.target.value)} placeholder="you@school.edu" autoComplete="email" required /></label>
      </div>
      <label>Subject<input value={supportSubject} onChange={(event) => setSupportSubject(event.target.value)} placeholder="How can we help?" required /></label>
      <label>Message<textarea value={supportMessage} onChange={(event) => setSupportMessage(event.target.value)} placeholder="Tell us what happened or what you need help with." required /></label>
      {supportStatus ? <div className="support-status">{supportStatus}</div> : null}
      <button type="submit" disabled={isSendingSupport} className="support-submit">
        {isSendingSupport ? <Loader2 size={17} className="spin" /> : <Mail size={17} />}
        {isSendingSupport ? "Sending..." : "Send support message"}
      </button>
    </form>
  );
}

function MaintenancePage({ maintenance }: { maintenance: PublicAccessSettings["maintenance"] }) {
  return (
    <main className="maintenance-shell">
      <div className="site-grid-bg" aria-hidden="true" />
      <div className="maintenance-glow one" aria-hidden="true" />
      <div className="maintenance-glow two" aria-hidden="true" />
      <section className="maintenance-card">
        <div className="maintenance-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
          <BrainCircuit size={54} />
        </div>
        <div className="site-eyebrow"><Sparkles size={15} /> System maintenance</div>
        <h1>Classroom Design Suite is getting an upgrade.</h1>
        <p>{maintenance.message || "We are improving the workspace, classroom output flow, and system performance. Please check back shortly."}</p>
        <div className="maintenance-time-card">
          <small>Estimated return</small>
          <strong>{formatMaintenanceTime(maintenance.until)}</strong>
        </div>
        <div className="maintenance-progress" aria-hidden="true"><span /></div>
        <ContactSupportToggle
          variant="maintenance"
          defaultSubject="Maintenance support request"
          buttonLabel="Contact support"
          helperText="Need help while the system is offline? Open the support form when needed."
        />
      </section>
    </main>
  );
}

function LandingPage({
  authMode,
  accessStatus,
  isChecking,
  name,
  email,
  password,
  otp,
  otpRequired,
  onModeChange,
  onNameChange,
  onEmailChange,
  onPasswordChange,
  onOtpChange,
  onSubmit,
  onGoogleSignIn,
  allowNewSignups
}: {
  authMode: AuthMode;
  accessStatus: string;
  isChecking: boolean;
  name: string;
  email: string;
  password: string;
  otp: string;
  otpRequired: boolean;
  onModeChange: (value: AuthMode) => void;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onOtpChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onGoogleSignIn: () => void;
  allowNewSignups: boolean;
}) {
  const isSignup = authMode === "signup";

  function goToAuth(mode: AuthMode) {
    onModeChange(mode);
    window.requestAnimationFrame(() => {
      document.getElementById("signup")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <main className="site-shell">
      <div className="site-grid-bg" aria-hidden="true" />
      <div className="site-glow site-glow-a" aria-hidden="true" />
      <div className="site-glow site-glow-b" aria-hidden="true" />

      <header className="site-nav">
        <a className="site-brand" href="#top" aria-label="Classroom Design Suite home">
          <span className="site-logo"><BrainCircuit size={24} /></span>
          <span><strong>Classroom Design Suite</strong><small>Learning design tools for teachers</small></span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#about">About</a>
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#inside">What&apos;s inside</a>
          <a href="#contact">Contact</a>
        </nav>
        <div className="site-nav-actions">
          <button type="button" className="site-link-button" onClick={() => goToAuth("login")}>Log in</button>
          <button type="button" className="site-cta" onClick={() => goToAuth("signup")}>Get started <ArrowRight size={16} /></button>
        </div>
      </header>

      <section id="top" className="site-hero">
        <div className="site-hero-copy">
          <div className="site-eyebrow"><Sparkles size={15} /> DepEd-ready classroom workflow</div>
          <h1>Design lessons faster. Deliver materials with confidence.</h1>
          <p className="site-lead">
            A professional workspace that connects lesson planning, learner activity sheets, and presentation slides into one guided teaching workflow.
          </p>
          <div className="site-hero-actions">
            <button type="button" className="site-primary-link" onClick={() => goToAuth("signup")}>Request access <ArrowRight size={17} /></button>
            <a className="site-secondary-link" href="#inside">Preview highlights</a>
          </div>
          <div className="site-trust-row" aria-label="Core outputs">
            <span><FileText size={15} /> Lesson Plan</span>
            <span><BookOpenCheck size={15} /> LAS</span>
            <span><Presentation size={15} /> PPT</span>
          </div>
        </div>

        <div className="site-hero-visual" aria-label="Connected classroom output graphic">
          <div className="brain-canvas">
            <svg className="brain-lines" viewBox="0 0 600 460" role="presentation">
              <defs>
                <linearGradient id="siteLine" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" />
                  <stop offset="46%" stopColor="#14b8a6" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
                <filter id="siteLineGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <path className="brain-line-shadow" d="M300 230 C230 116 156 102 88 144" />
              <path className="brain-line-shadow" d="M300 230 C410 112 500 122 536 184" />
              <path className="brain-line-shadow" d="M300 230 C392 330 468 344 532 292" />
              <path id="pathPlan" className="brain-flow-line flow-one" d="M300 230 C230 116 156 102 88 144" />
              <path id="pathLas" className="brain-flow-line flow-two" d="M300 230 C410 112 500 122 536 184" />
              <path id="pathPpt" className="brain-flow-line flow-three" d="M300 230 C392 330 468 344 532 292" />
              <g className="brain-flow-orbs">
                <circle r="7"><animateMotion dur="3.2s" repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear"><mpath href="#pathPlan" /></animateMotion></circle>
                <circle r="7"><animateMotion dur="3.6s" repeatCount="indefinite" begin="-.8s" keyPoints="0;1" keyTimes="0;1" calcMode="linear"><mpath href="#pathLas" /></animateMotion></circle>
                <circle r="7"><animateMotion dur="4s" repeatCount="indefinite" begin="-1.4s" keyPoints="0;1" keyTimes="0;1" calcMode="linear"><mpath href="#pathPpt" /></animateMotion></circle>
              </g>
            </svg>
            <div className="brain-radar" />
            <div className="signal-dot signal-dot-one" />
            <div className="signal-dot signal-dot-two" />
            <div className="signal-dot signal-dot-three" />
            <div className="brain-core"><BrainCircuit size={72} /></div>
            <article className="tool-node node-plan"><LayoutTemplate size={19} /><strong>Plan</strong><span>structured lesson</span></article>
            <article className="tool-node node-las"><Clipboard size={19} /><strong>Practice</strong><span>learner activities</span></article>
            <article className="tool-node node-ppt"><MonitorPlay size={19} /><strong>Present</strong><span>slide deck</span></article>
            <div className="preview-stack"><span /><span /><span /></div>
          </div>
        </div>
      </section>

      <section id="about" className="site-section site-about">
        <div>
          <span className="section-kicker">About the suite</span>
          <h2>One workspace for everyday lesson preparation.</h2>
        </div>
        <p>
          Classroom Design Suite helps teachers prepare aligned, editable materials without jumping across disconnected tools. Start with lesson details, review the output, then generate matching activity sheets and slides.
        </p>
      </section>

      <section id="features" className="site-feature-grid">
        <article><FileText size={22} /><h3>Plan clearly</h3><p>Build a complete lesson structure with objectives, flow, assessment, and reflection.</p></article>
        <article><BookOpenCheck size={22} /><h3>Practice purposefully</h3><p>Generate learner activities that follow the approved lesson content.</p></article>
        <article><Presentation size={22} /><h3>Present confidently</h3><p>Convert the teaching flow into classroom-ready slide content.</p></article>
      </section>

      <section id="how-it-works" className="site-flow-section">
        <div className="site-section-heading">
          <span className="section-kicker">How it works</span>
          <h2>From idea to classroom materials in three steps.</h2>
        </div>
        <div className="site-flow-grid">
          <article><span>01</span><h3>Enter lesson details</h3><p>Add grade level, subject, competency, learning standards, schedule, and learner context.</p></article>
          <article><span>02</span><h3>Generate and review</h3><p>Create the lesson plan first, then use the reviewed content as the source for LAS and PPT.</p></article>
          <article><span>03</span><h3>Download outputs</h3><p>Save editable documents and presentation files for final checking, printing, and teaching.</p></article>
        </div>
      </section>

      <section id="inside" className="site-preview-section preview-showcase-section">
        <div className="site-section-heading preview-heading">
          <span className="section-kicker">Preview highlights</span>
          <h2>A guided workspace with ready-to-use outputs.</h2>
          <p>See how one lesson setup becomes a structured lesson plan, learner activity sheet, and presentation deck.</p>
        </div>

        <div className="product-preview-mockup" aria-label="Classroom Design Suite interface preview">
          <div className="mockup-window-bar">
            <span />
            <span />
            <span />
            <strong>Classroom Design Suite</strong>
            <small>Lesson workspace preview</small>
          </div>
          <div className="mockup-workspace-grid">
            <aside className="mockup-sidebar">
              <div className="mockup-brand-dot"><BrainCircuit size={20} /></div>
              <button className="active" type="button"><FileText size={15} /> Lesson Plan</button>
              <button type="button"><BookOpenCheck size={15} /> LAS</button>
              <button type="button"><Presentation size={15} /> PPT</button>
            </aside>
            <div className="mockup-editor-panel">
              <div className="mockup-editor-title">
                <span>Lesson setup</span>
                <strong>Grade 10 · Science · 60 minutes</strong>
              </div>
              <div className="mockup-field-row"><span>Learning competency</span><div /></div>
              <div className="mockup-field-row wide"><span>Session objectives</span><div /></div>
              <div className="mockup-field-grid"><i /><i /><i /><i /></div>
              <button type="button" className="mockup-generate-button"><Sparkles size={15} /> Generate outputs</button>
            </div>
            <div className="mockup-output-panel">
              <div className="mockup-output-header"><span>Output preview</span><strong>Ready</strong></div>
              <div className="mockup-output-card lesson"><FileText size={17} /><div><strong>Lesson Plan</strong><small>Objectives · lesson flow · assessment</small></div></div>
              <div className="mockup-output-card las"><BookOpenCheck size={17} /><div><strong>Learner Activity Sheet</strong><small>Guided tasks · checks · reflection</small></div></div>
              <div className="mockup-output-card ppt"><Presentation size={17} /><div><strong>Presentation Deck</strong><small>Slides · visuals · discussion prompts</small></div></div>
            </div>
          </div>
        </div>

        <div className="template-preview-grid skills-preview-grid">
          <article className="template-card lesson-template skill-output-card">
            <div className="template-card-head skill-card-head">
              <span>ILAW-aligned planning</span>
              <strong>Lesson Plan</strong>
            </div>
            <p className="skill-output-copy">
              Build a structured teaching blueprint with session objectives, content flow, learner tasks, assessment, and reflection aligned to the ILAW framework.
            </p>
            <div className="skill-output-list">
              <span><CheckCircle2 size={15} /> Session Objectives</span>
              <span><CheckCircle2 size={15} /> Lesson Flow</span>
              <span><CheckCircle2 size={15} /> Assessment & Reflection</span>
            </div>
          </article>
          <article className="template-card las-template skill-output-card">
            <div className="template-card-head skill-card-head">
              <span>Learner practice</span>
              <strong>Learning Activity Sheets</strong>
            </div>
            <p className="skill-output-copy">
              Turn the approved lesson plan into learner-ready activities that guide practice, self-checking, collaboration, and meaningful application.
            </p>
            <div className="skill-output-list">
              <span><CheckCircle2 size={15} /> Guided Activities</span>
              <span><CheckCircle2 size={15} /> Self-check Tasks</span>
              <span><CheckCircle2 size={15} /> LAS-ready Layout</span>
            </div>
          </article>
          <article className="template-card ppt-template skill-output-card">
            <div className="template-card-head skill-card-head">
              <span>Classroom delivery</span>
              <strong>Presentation Slides</strong>
            </div>
            <p className="skill-output-copy">
              Generate a presentation path from the same lesson flow, with objectives, key concepts, prompts, checks for understanding, and visual slide guidance.
            </p>
            <div className="slide-mini-stack branded-slide-stack" aria-hidden="true">
              <div><span>Objectives</span></div>
              <div><span>Concept</span></div>
              <div><span>Practice</span></div>
            </div>
          </article>
        </div>
      </section>

      <section id="signup" className="site-auth-contact-grid">
        <div className="auth-card-pro">
          <div className="auth-brand-mini">
            <span><BrainCircuit size={26} /></span>
            <strong>Classroom Design Suite</strong>
            <small>{isSignup ? "Create your account" : "Welcome back"}</small>
          </div>
          <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
            <button type="button" className={isSignup ? "active" : ""} onClick={() => onModeChange("signup")} disabled={!allowNewSignups}><UserPlus size={16} /> Sign up</button>
            <button type="button" className={!isSignup ? "active" : ""} onClick={() => onModeChange("login")}><LogIn size={16} /> Sign in</button>
          </div>
          <button type="button" className="google-button" onClick={onGoogleSignIn}><span>G</span> Continue with Google</button>
          <div className="auth-divider"><span>or use email</span></div>
          <form onSubmit={onSubmit} className="auth-form-pro">
            {isSignup ? (
              <label>Full name<div><User size={17} /><input value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="Ada Lovelace" autoComplete="name" /></div></label>
            ) : null}
            <label>Email<div><Mail size={17} /><input value={email} onChange={(event) => onEmailChange(event.target.value)} placeholder="you@gmail.com" autoComplete="email" /></div></label>
            <label>Password<div><Lock size={17} /><input type="password" value={password} onChange={(event) => onPasswordChange(event.target.value)} placeholder={isSignup ? "At least 8 characters" : "Enter your password"} autoComplete={isSignup ? "new-password" : "current-password"} /></div></label>
            {isSignup && otpRequired ? (
              <label>Verification code<div><KeyRound size={17} /><input value={otp} onChange={(event) => onOtpChange(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" inputMode="numeric" autoComplete="one-time-code" /></div></label>
            ) : null}
            {isSignup ? <p className="auth-helper">{allowNewSignups ? "Google sign-in activates instantly. Email signup sends a 6-digit verification code and accepts major email providers only." : "New account registration is currently closed. Existing users may still sign in."}</p> : null}
            {accessStatus ? <div className="login-status auth-status">{accessStatus}</div> : null}
            <button type="submit" disabled={isChecking || (isSignup && !allowNewSignups)} className="auth-submit">
              {isChecking ? <Loader2 className="spin" size={18} /> : isSignup ? <UserPlus size={18} /> : <ShieldCheck size={18} />}
              {isChecking ? "Please wait..." : isSignup ? (otpRequired ? "Verify and create account" : "Send verification code") : "Sign in"}
            </button>
          </form>
        </div>

        <div id="contact" className="contact-panel">
          <span className="section-kicker">Contact</span>
          <h2>Need access or support?</h2>
          <p>For onboarding, verification, or school deployment assistance, contact Lloydie Labs using the support form below.</p>
          <div className="contact-cards">
            <article><Building2 size={21} /><span>Company</span><strong>Lloydie Labs</strong></article>
            <article><Globe2 size={21} /><span>Official website</span><strong>lloydielabs.site</strong></article>
            <article><Mail size={21} /><span>Contact</span><strong>support@lloydielabs.site</strong></article>
          </div>
        </div>
        <div className="support-below-auth" id="contact-support">
          <ContactSupportToggle
            defaultName={name}
            defaultEmail={email}
            defaultSubject="Support request"
            buttonLabel="Contact support"
            helperText=""
          />
        </div>
      </section>

      <footer className="site-footer">
        <span>© {new Date().getFullYear()} Lloydie Labs. All rights reserved.</span>
        <span>Classroom Design Suite</span>
      </footer>
    </main>
  );
}

function MaterialGeneratingPanel({
  title,
  message,
  steps
}: {
  title: string;
  message: string;
  steps: string[];
}) {
  return (
    <div className="material-loading-card" aria-live="polite">
      <div className="material-loading-header">
        <div className="mini-ai-orb">
          <Sparkles size={20} />
        </div>
        <div>
          <strong>{title}</strong>
          <span>{message}</span>
        </div>
      </div>
      <div className="smart-progress" aria-hidden="true">
        <span />
      </div>
      <ul className="material-loading-steps">
        {steps.map((step, index) => (
          <li key={step} className={index < 2 ? "active" : ""}>
            {index < 2 ? <CheckCircle2 size={14} /> : <Loader2 size={14} className="spin" />}
            {step}
          </li>
        ))}
      </ul>
    </div>
  );
}

function GeneratingPanel({
  title,
  message,
  steps
}: {
  title: string;
  message: string;
  steps: string[];
}) {
  return (
    <div className="generating-panel" aria-live="polite">
      <div className="ai-orb">
        <Sparkles size={34} />
      </div>
      <div className="ai-loader" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <h2>{title}</h2>
      <p>{message}</p>
      <div className="smart-progress preview-progress" aria-hidden="true">
        <span />
      </div>
      <ol className="generation-steps">
        {steps.map((step, index) => (
          <li key={step} className={index < 3 ? "active" : ""}>
            {index < 2 ? <CheckCircle2 size={15} /> : index === 2 ? <Loader2 size={15} className="spin" /> : <FileText size={15} />}
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}

function PreviewPlaceholder({
  icon,
  title,
  message
}: {
  icon: ReactNode;
  title: string;
  message: string;
}) {
  return (
    <div className="preview-empty preview-tab-empty">
      {icon}
      <p><strong>{title}</strong></p>
      <p className="preview-empty-sub">{message}</p>
    </div>
  );
}

function OutputReadyCard({
  eyebrow,
  title,
  message,
  filename,
  children
}: {
  eyebrow: string;
  title: string;
  message: string;
  filename: string;
  children: ReactNode;
}) {
  return (
    <div className="output-ready-panel">
      <div className="output-ready-icon">
        <CheckCircle2 size={30} />
      </div>
      <span className="output-ready-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      <p>{message}</p>
      <div className="output-file-card">
        <FileText size={18} />
        <span>{filename}</span>
      </div>
      <div className="output-ready-actions">
        {children}
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  required,
  placeholder,
  error
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  error?: string;
}) {
  return (
    <div className={`field ${error ? "has-error" : ""}`}>
      <label>
        {label}
        {required ? " *" : ""}
      </label>
      <input
        required={required}
        value={inputValue(value)}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
      />
      {error ? <p className="field-error-text">{error}</p> : null}
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  required,
  placeholder,
  warning,
  error
}: {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  warning?: string;
  error?: string;
}) {
  return (
    <div className={`field ${error ? "has-error" : ""}`}>
      <label>
        {label}
        {required ? " *" : ""}
      </label>
      <textarea
        required={required}
        value={inputValue(value)}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
      />
      {error ? <p className="field-error-text">{error}</p> : null}
      {warning ? <p className="field-warning">{warning}</p> : null}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  required,
  placeholder,
  error
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  required?: boolean;
  placeholder?: string;
  error?: string;
}) {
  return (
    <div className={`field ${error ? "has-error" : ""}`}>
      <label>
        {label}
        {required ? " *" : ""}
      </label>
      <select
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
      >
        {options.map((option) => {
          const optionValue = typeof option === "string" ? option : option.value;
          const optionLabel = typeof option === "string" ? option : option.label;
          return (
            <option value={optionValue} key={optionValue || optionLabel || placeholder || "blank"}>
              {optionLabel || placeholder || "Select"}
            </option>
          );
        })}
      </select>
      {error ? <p className="field-error-text">{error}</p> : null}
    </div>
  );
}

function ThemePicker({
  label,
  value,
  onChange,
  options,
  className = "",
  collapsedLabel = "Show more"
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: VisualPickerOption[];
  className?: string;
  collapsedLabel?: string;
}) {
  const selectedIsHidden = !options.slice(0, 2).some((option) => option.value === value);
  const [expanded, setExpanded] = useState(selectedIsHidden);
  const isExpanded = expanded || selectedIsHidden;
  const visibleOptions = isExpanded ? options : options.slice(0, 2);

  return (
    <div className={`theme-picker field ${className}`.trim()}>
      <div className="visual-picker-title">
        <label>{label}</label>
        <span>{options.length} options</span>
      </div>
      <div className={`theme-option-grid ${isExpanded ? "expanded" : "collapsed"}`} role="radiogroup" aria-label={label}>
        {visibleOptions.map((option) => {
          const isSelected = value === option.value;
          return (
            <button
              type="button"
              key={option.value}
              className={`theme-option-button visual-option ${option.previewType ? `visual-${option.previewType}` : ""} ${option.previewClass || ""} ${isSelected ? "selected" : ""}`}
              onClick={() => onChange(option.value)}
              role="radio"
              aria-checked={isSelected}
            >
              <span className="theme-preview" aria-hidden="true">
                {option.previewImage ? (
                  <img src={option.previewImage} alt="" loading="lazy" />
                ) : (
                  <>
                    <span className="theme-preview-card">
                      <strong>Title</strong>
                      <small>Body &amp; link</small>
                    </span>
                    <span className="theme-preview-accent one" />
                    <span className="theme-preview-accent two" />
                    <span className="theme-preview-art-grid">
                      {Array.from({ length: option.previewType === "style" ? 5 : 4 }).map((_, index) => (
                        <i key={index} />
                      ))}
                    </span>
                  </>
                )}
              </span>
              <span className="theme-option-copy">
                <span className="option-name-row">
                  <strong>{option.label}</strong>
                  {option.tag ? <em>{option.tag}</em> : null}
                </span>
                <small>{option.helper}</small>
              </span>
            </button>
          );
        })}
        {!isExpanded ? (
          <button type="button" className="theme-option-button visual-option show-more-option" onClick={() => setExpanded(true)}>
            <span className="show-more-icon"><Sparkles size={22} /></span>
            <span className="theme-option-copy">
              <span className="option-name-row">
                <strong>Show More</strong>
                <em>{options.length - 2} more</em>
              </span>
              <small>{collapsedLabel}. Expand this selector to choose from all available visual options.</small>
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

function GroupedSelect({
  label,
  value,
  onChange,
  groups,
  required,
  placeholder,
  error
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  groups: SelectGroup[];
  required?: boolean;
  placeholder?: string;
  error?: string;
}) {
  return (
    <div className={`field ${error ? "has-error" : ""}`}>
      <label>
        {label}
        {required ? " *" : ""}
      </label>
      <select
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
      >
        <option value="">{placeholder || "Select"}</option>
        {groups.map((group) => (
          <optgroup label={group.label} key={group.label}>
            {group.options.map((option) => {
              const value = optionValue(option);
              const label = optionLabel(option);
              return (
                <option value={value} key={group.label + "-" + value}>
                  {label}
                </option>
              );
            })}
          </optgroup>
        ))}
      </select>
      {error ? <p className="field-error-text">{error}</p> : null}
    </div>
  );
}


function shouldEmphasizeLabel(label: string) {
  const cleaned = label.trim();
  if (!cleaned || cleaned.length > 72) return false;
  // Allow slash-based teaching labels such as "Guided Practice/CFU" and
  // "Social Learning / Collaboration". Only reject labels that look like
  // URLs, emails, or file paths.
  if (/https?:|www\.|@|\.com\b|\.gov\b|\.edu\b/i.test(cleaned)) return false;
  if (/^[A-Za-z]:\\/.test(cleaned) || /^\//.test(cleaned)) return false;
  return /[A-Za-z]/.test(cleaned);
}

function renderEmphasizedText(value: string, prefix = "") {
  const text = `${prefix}${value}`;
  if (/^(Textbooks and Modules|Websites)$/i.test(text.trim())) {
    return <strong>{text}</strong>;
  }
  const bullet = text.match(/^(\s*•\s*)(.*)$/);
  const bulletPrefix = bullet ? bullet[1] : "";
  const body = bullet ? bullet[2] : text;
  const match = body.match(/^([^:]{1,62}):\s*(.*)$/);

  if (!match || !shouldEmphasizeLabel(match[1])) {
    return text;
  }

  return (
    <>
      {bulletPrefix}
      <strong>{match[1].trim()}:</strong>
      {match[2] ? ` ${match[2]}` : ""}
    </>
  );
}

function renderText(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => (
      <span key={`${line}-${index}`}>
        {renderEmphasizedText(line)}
        <br />
      </span>
    ));

}

function renderIntegrationText(value: string) {
  return renderText(formatIntegrationText(value) || value || " ");
}

function renderNumbered(values: string[]) {
  return values.map((value, index) => (
    <span key={`${value}-${index}`}>
      {index + 1}. {renderEmphasizedText(value)}
      <br />
    </span>
  ));
}

function renderBullets(values: string[]) {
  return values.map((value, index) => (
    <span key={`${value}-${index}`}>
      {renderEmphasizedText(value, "• ")}
      <br />
    </span>
  ));
}

function renderLearningObjectives(session: SessionPlan) {
  return (
    <>
      <span className="objective-stem">By the end of {session.label}, learners will be able to:</span>
      <br />
      {renderBullets(session.learningObjectives.map((objective) => cleanObjectiveText(objective, session.sessionNumber)))}
    </>
  );
}

function Preview({ form, lesson }: { form: LessonInput; lesson: GeneratedLesson }) {
  const sessions = lesson.sessions.length ? lesson.sessions : [];
  const sessionCount = Math.max(1, sessions.length);

  return (
    <div className="preview-wrap">
      <article
        className={`paper ${form.pageOrientation === "Portrait" ? "portrait" : "landscape"}`}
      >
        <h2 className="paper-heading">LESSON PLAN TEMPLATE</h2>
        <table className="wlp-table">
          <tbody>
            <tr>
              <th>Lesson Title</th>
              <td colSpan={sessionCount}>{lesson.title || " "}</td>
            </tr>
            <tr>
              <th>Learning Area/s</th>
              <td colSpan={sessionCount}>{lesson.learningArea || " "}</td>
            </tr>
            <tr>
              <th>Name of Teacher/s</th>
              <td colSpan={sessionCount}>{lesson.teacherName || " "}</td>
            </tr>
            <tr>
              <th>Grade Level and Section</th>
              <td colSpan={sessionCount}>{lesson.gradeLevelSection || " "}</td>
            </tr>
            <tr>
              <th>Term / Week / Teaching Dates / School Year</th>
              <td colSpan={sessionCount}>{`${lesson.term || " "} | ${lesson.week || " "} | ${lesson.teachingDates || form.teachingDates || " "} | S.Y. ${lesson.schoolYear || form.schoolYear || " "}`}</td>
            </tr>
            <tr>
              <th>No. of Sessions</th>
              <td colSpan={sessionCount}>
                {`${sessionCount} Session${sessionCount === 1 ? "" : "s"}`}
              </td>
            </tr>
            <tr>
              <th>Duration of Each Session</th>
              <td colSpan={sessionCount}>{`${form.sessionDurationMinutes || 60} minutes`}</td>
            </tr>
            <tr>
              <th>
                References
                <small>{OFFICIAL_TEMPLATE_HELPERS.references}</small>
              </th>
              <td colSpan={sessionCount}>{renderText(lesson.references || " ")}</td>
            </tr>
            <tr>
              <th>
                Declaration of AI use
                <small>{OFFICIAL_TEMPLATE_HELPERS.aiUse}</small>
              </th>
              <td colSpan={sessionCount}>{lesson.aiUseDeclaration || " "}</td>
            </tr>
            <tr className="band">
              <th>Intentions.</th>
              <td colSpan={sessionCount}>{OFFICIAL_TEMPLATE_NARRATIVES.intentions}</td>
            </tr>
            <tr>
              <th>
                Learning Competency and Curriculum Standards:
                <small>{OFFICIAL_TEMPLATE_HELPERS.competency}</small>
              </th>
              <td colSpan={sessionCount}>
                <strong>Learning Competency:</strong>
                <br />
                {renderText(lesson.learningCompetency || " ")}
                <br />
                <strong>Content Standard:</strong>
                <br />
                {renderText(lesson.contentStandard || form.contentStandard || " ")}
                <br />
                <strong>Performance Standard:</strong>
                <br />
                {renderText(lesson.performanceStandard || form.performanceStandard || " ")}
              </td>
            </tr>
            <tr>
              <th className="session-spacer"> </th>
              {sessions.map((session) => (
                <td key={session.sessionNumber} className="session-head">
                  {formatSessionHeaderLabel(session.label, form.sessionDurationMinutes)}
                </td>
              ))}
            </tr>
            <tr>
              <th>Learning Objectives:<small>{OFFICIAL_TEMPLATE_HELPERS.objectives}</small></th>
              {sessions.map((session) => (
                <td key={session.sessionNumber}>
                  {renderLearningObjectives(session)}
                </td>
              ))}
            </tr>
            <tr>
              <th>
                Learner Context:
                <small>{OFFICIAL_TEMPLATE_HELPERS.learnerContext}</small>
              </th>
              <td colSpan={sessionCount}>{lesson.learnerContext || " "}</td>
            </tr>
            <tr className="band">
              <th>Learning Experience.</th>
              <td colSpan={sessionCount}>{OFFICIAL_TEMPLATE_NARRATIVES.learningExperience}</td>
            </tr>
            <tr>
              <th>Pre-Lesson:<small>{OFFICIAL_TEMPLATE_HELPERS.preLesson}</small></th>
              {sessions.map((session) => (
                <td key={session.sessionNumber}>{renderText(session.preLesson)}</td>
              ))}
            </tr>
            <tr>
              <th>Flow:<small>{OFFICIAL_TEMPLATE_HELPERS.flow}</small></th>
              {sessions.map((session) => (
                <td key={session.sessionNumber}>{renderNumbered(session.flow)}</td>
              ))}
            </tr>
            <tr>
              <th>Learning Resources:<small>{OFFICIAL_TEMPLATE_HELPERS.resources}</small></th>
              {sessions.map((session) => (
                <td key={session.sessionNumber}>{renderText(session.learningResources)}</td>
              ))}
            </tr>
            <tr>
              <th>Opportunities for integration:<small>{OFFICIAL_TEMPLATE_HELPERS.integration}</small></th>
              {sessions.map((session) => (
                <td key={session.sessionNumber}>{renderIntegrationText(session.integration)}</td>
              ))}
            </tr>
            <tr className="band">
              <th>Assessment.</th>
              <td colSpan={sessionCount}>{OFFICIAL_TEMPLATE_NARRATIVES.assessment}</td>
            </tr>
            <tr>
              <th>Formative Assessment:<small>{OFFICIAL_TEMPLATE_HELPERS.formativeAssessment}</small></th>
              {sessions.map((session) => (
                <td key={session.sessionNumber}>
                  {renderNumbered(session.formativeAssessment)}
                </td>
              ))}
            </tr>
            <tr className="band">
              <th>Ways Forward.</th>
              <td colSpan={sessionCount}>{OFFICIAL_TEMPLATE_NARRATIVES.waysForward}</td>
            </tr>
            <tr>
              <th>Extended learning opportunities:<small>{OFFICIAL_TEMPLATE_HELPERS.extendedLearning}</small></th>
              {sessions.map((session) => (
                <td key={session.sessionNumber}>{renderText(session.extendedLearning)}</td>
              ))}
            </tr>
            <tr>
              <th>Reflections:<small>{OFFICIAL_TEMPLATE_HELPERS.reflections}</small></th>
              {sessions.map((session) => (
                <td key={session.sessionNumber}>{renderText(session.reflectionPrompt || "Possible teacher reflection: note learner engagement, misconceptions, adjustments, support for struggling learners, and recommendation for the next lesson.")}</td>
              ))}
            </tr>
          </tbody>
        </table>
        <table className="teacher-signature-preview">
          <tbody>
            <tr>
              <td>
                <strong>Prepared by:</strong>
                <br />
                <strong>{form.teacherName || lesson.teacherName || " "}</strong>
                <br />
                {form.teacherRole || " "}
              </td>
              <td>
                <strong>Checked by:</strong>
                <br />
                <strong>{form.checkedBy || " "}</strong>
                <br />
                {form.checkerRole || " "}
              </td>
            </tr>
          </tbody>
        </table>
        <h3 className="rubric-heading">{SELF_CHECK_RUBRIC_TITLE}</h3>
        <table className="rubric-preview">
          <tbody>
            <tr>
              <th>I can say that in my lesson plan...</th>
              <th>Yes</th>
              <th>Not Yet</th>
              <th>Why?/ What will make it better?</th>
            </tr>
            {rubricItems.map((item) => (
              <tr key={item}>
                <td>{item}</td>
                <td> </td>
                <td> </td>
                <td> </td>
              </tr>
            ))}
            <tr>
              <td colSpan={4}><strong>Notes for my instructional coaching session:</strong></td>
            </tr>
          </tbody>
        </table>
      </article>
    </div>
  );
}
