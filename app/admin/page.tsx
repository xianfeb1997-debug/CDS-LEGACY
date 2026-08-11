"use client";

import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Database,
  Download,
  KeyRound,
  Loader2,
  Plus,
  RefreshCcw,
  RotateCcw,
  Save,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  Users
} from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type AdminUser = {
  id: number;
  label: string;
  email: string;
  accessKey: string;
  authProvider: string;
  creditLimit: number | null;
  creditsUsed: number;
  pptCreditLimit: number | null;
  pptCreditsUsed: number;
  lasHeaderDivision: string;
  lasHeaderSchoolName: string;
  textModel: string;
  textApiKey: string;
  textBaseUrl: string;
  isActive: boolean;
  notes: string;
  lastUsedAt: string | null;
};

type TextApiKey = {
  id: number;
  label: string;
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
  priority: number;
  isActive: boolean;
  useCount: number;
  lastUsedAt: string | null;
};

type GammaApiKey = {
  id: number;
  label: string;
  apiKey: string;
  priority: number;
  isActive: boolean;
  useCount: number;
  lastUsedAt: string | null;
};

type GlobalSettings = {
  lasHeaderDivision: string;
  lasHeaderSchoolName: string;
  gammaApiBaseUrl: string;
  defaultLessonCreditLimit: number;
  defaultPptCreditLimit: number;
  allowNewSignups: boolean;
  maintenanceModeEnabled: boolean;
  maintenanceUntil: string;
  maintenanceMessage: string;
};

type AdminData = {
  configured: boolean;
  users: AdminUser[];
  textApiKeys: TextApiKey[];
  gammaApiKeys: GammaApiKey[];
  settings: GlobalSettings;
  stats: {
    totalUsers: number;
    activeUsers: number;
    totalCreditsUsed: number;
    totalTextCreditsUsed?: number;
    totalPptCreditsUsed?: number;
    activeApiKeys: number;
    activeGammaApiKeys?: number;
  };
  message?: string;
};

type UserForm = {
  label: string;
  email: string;
  accessKey: string;
  authProvider: string;
  creditLimit: string;
  creditsUsed: string;
  pptCreditLimit: string;
  pptCreditsUsed: string;
  lasHeaderDivision: string;
  lasHeaderSchoolName: string;
  textModel: string;
  textApiKey: string;
  textBaseUrl: string;
  isActive: boolean;
  notes: string;
};

type ApiKeyForm = {
  label: string;
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
  priority: string;
  isActive: boolean;
};

type GammaKeyForm = {
  label: string;
  apiKey: string;
  priority: string;
  isActive: boolean;
};

type SettingsForm = {
  lasHeaderDivision: string;
  lasHeaderSchoolName: string;
  gammaApiBaseUrl: string;
  defaultLessonCreditLimit: string;
  defaultPptCreditLimit: string;
  allowNewSignups: boolean;
  maintenanceModeEnabled: boolean;
  maintenanceUntil: string;
  maintenanceMessage: string;
};

type AdminTab = "users" | "api-keys" | "gamma-keys" | "settings";

const emptyUserForm: UserForm = {
  label: "",
  email: "",
  accessKey: "",
  authProvider: "email",
  creditLimit: "100",
  creditsUsed: "0",
  pptCreditLimit: "20",
  pptCreditsUsed: "0",
  lasHeaderDivision: "",
  lasHeaderSchoolName: "",
  textModel: "",
  textApiKey: "",
  textBaseUrl: "",
  isActive: true,
  notes: ""
};

const emptyApiKeyForm: ApiKeyForm = {
  label: "",
  provider: "OpenAI compatible",
  apiKey: "",
  model: "",
  baseUrl: "",
  priority: "100",
  isActive: true
};

const emptyGammaKeyForm: GammaKeyForm = {
  label: "",
  apiKey: "",
  priority: "100",
  isActive: true
};

const emptySettingsForm: SettingsForm = {
  lasHeaderDivision: "Division of General Santos City",
  lasHeaderSchoolName: "GENERAL SANTOS CITY NATIONAL HIGH SCHOOL",
  gammaApiBaseUrl: "https://public-api.gamma.app/v1.0",
  defaultLessonCreditLimit: "100",
  defaultPptCreditLimit: "20",
  allowNewSignups: true,
  maintenanceModeEnabled: false,
  maintenanceUntil: "",
  maintenanceMessage: "We are improving Classroom Design Suite. Please check back soon."
};


function toDateTimeLocalValue(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromDateTimeLocalValue(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (item: number) => String(item).padStart(2, "0");
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const offset = `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00${offset}`;
}

function dateLabel(value: string | null) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function maskKey(value: string) {
  if (!value) return "Uses global keys";
  if (value.length <= 10) return "••••••";
  return `${value.slice(0, 4)}••••••${value.slice(-4)}`;
}

function userToForm(user: AdminUser): UserForm {
  return {
    label: user.label,
    email: user.email || "",
    accessKey: user.accessKey,
    authProvider: user.authProvider || "email",
    creditLimit: user.creditLimit === null ? "" : String(user.creditLimit),
    creditsUsed: String(user.creditsUsed),
    pptCreditLimit: user.pptCreditLimit === null ? "" : String(user.pptCreditLimit),
    pptCreditsUsed: String(user.pptCreditsUsed),
    lasHeaderDivision: user.lasHeaderDivision || "",
    lasHeaderSchoolName: user.lasHeaderSchoolName || "",
    textModel: user.textModel || "",
    textApiKey: user.textApiKey || "",
    textBaseUrl: user.textBaseUrl || "",
    isActive: user.isActive,
    notes: user.notes || ""
  };
}

function apiKeyToForm(apiKey: TextApiKey): ApiKeyForm {
  return {
    label: apiKey.label,
    provider: apiKey.provider || "OpenAI compatible",
    apiKey: apiKey.apiKey,
    model: apiKey.model || "",
    baseUrl: apiKey.baseUrl || "",
    priority: String(apiKey.priority ?? 100),
    isActive: apiKey.isActive
  };
}

function gammaKeyToForm(apiKey: GammaApiKey): GammaKeyForm {
  return {
    label: apiKey.label,
    apiKey: apiKey.apiKey,
    priority: String(apiKey.priority ?? 100),
    isActive: apiKey.isActive
  };
}

function settingsToForm(settings?: GlobalSettings): SettingsForm {
  return {
    lasHeaderDivision: settings?.lasHeaderDivision || emptySettingsForm.lasHeaderDivision,
    lasHeaderSchoolName: settings?.lasHeaderSchoolName || emptySettingsForm.lasHeaderSchoolName,
    gammaApiBaseUrl: settings?.gammaApiBaseUrl || emptySettingsForm.gammaApiBaseUrl,
    defaultLessonCreditLimit: String(settings?.defaultLessonCreditLimit ?? 100),
    defaultPptCreditLimit: String(settings?.defaultPptCreditLimit ?? 20),
    allowNewSignups: settings?.allowNewSignups ?? true,
    maintenanceModeEnabled: settings?.maintenanceModeEnabled ?? false,
    maintenanceUntil: toDateTimeLocalValue(settings?.maintenanceUntil || ""),
    maintenanceMessage: settings?.maintenanceMessage || emptySettingsForm.maintenanceMessage
  };
}

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [data, setData] = useState<AdminData | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editingApiKeyId, setEditingApiKeyId] = useState<number | null>(null);
  const [editingGammaKeyId, setEditingGammaKeyId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>("users");
  const [restoreMode, setRestoreMode] = useState<"merge" | "replace">("merge");
  const [backupFileName, setBackupFileName] = useState("");
  const [userForm, setUserForm] = useState<UserForm>(emptyUserForm);
  const [apiKeyForm, setApiKeyForm] = useState<ApiKeyForm>(emptyApiKeyForm);
  const [gammaKeyForm, setGammaKeyForm] = useState<GammaKeyForm>(emptyGammaKeyForm);
  const [settingsForm, setSettingsForm] = useState<SettingsForm>(emptySettingsForm);

  useEffect(() => {
    const stored = window.sessionStorage.getItem("ilaw_admin_token") || "";
    if (stored) {
      setAdminKey(stored);
      setAuthorized(true);
      void loadAdminData(stored);
    }
  }, []);

  useEffect(() => {
    if (data?.settings) {
      setSettingsForm(settingsToForm(data.settings));
    }
  }, [data?.settings]);

  const creditRiskUsers = useMemo(
    () => (data?.users || []).filter((user) =>
      (user.creditLimit !== null && user.creditsUsed >= user.creditLimit) ||
      (user.pptCreditLimit !== null && user.pptCreditsUsed >= user.pptCreditLimit)
    ),
    [data]
  );

  const tabCopy = {
    users: {
      eyebrow: "Account Access",
      title: "User accounts",
      description: "Approve Google/email signups, set Lesson/LAS and PPT limits, and assign optional per-user overrides."
    },
    "api-keys": {
      eyebrow: "Text Model Routing",
      title: "Rotating text API keys",
      description: "Use these keys for Lesson Plan and LAS text generation. Active keys rotate by priority, least use, and oldest use."
    },
    "gamma-keys": {
      eyebrow: "Presentation Service",
      title: "Gamma API keys",
      description: "Store presentation API keys in Admin instead of .env.local. PPT jobs rotate across active Gamma keys."
    },
    settings: {
      eyebrow: "Global Defaults",
      title: "Global settings",
      description: "Set signup credits, registration access, maintenance mode, LAS headers, and Gamma service settings."
    }
  }[activeTab];

  async function adminFetch(body?: unknown, tokenOverride?: string) {
    const token = tokenOverride || adminKey;
    const response = await fetch("/api/admin", {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Token": token
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store"
    });
    const nextData = (await response.json()) as AdminData & { error?: string };

    if (!response.ok) {
      const error = new Error(nextData.error || "Admin request failed.") as Error & { status?: number };
      error.status = response.status;
      throw error;
    }

    setData(nextData);
    return nextData;
  }

  async function loadAdminData(tokenOverride?: string) {
    setIsLoading(true);
    setMessage("Loading admin panel...");
    try {
      const next = await adminFetch(undefined, tokenOverride);
      setMessage(next.configured ? "Admin panel connected." : next.message || "Database setup required.");
    } catch (error) {
      const status = error instanceof Error ? (error as Error & { status?: number }).status : undefined;
      if (status === 401) {
        setAuthorized(false);
        window.sessionStorage.removeItem("ilaw_admin_token");
      } else {
        setAuthorized(true);
      }
      setMessage(error instanceof Error ? error.message : "Unable to load admin panel.");
    } finally {
      setIsLoading(false);
    }
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = adminKey.trim();
    if (!trimmed) {
      setMessage("Enter the admin key.");
      return;
    }

    setAuthorized(true);
    window.sessionStorage.setItem("ilaw_admin_token", trimmed);
    await loadAdminData(trimmed);
  }

  function signOut() {
    setAuthorized(false);
    setAdminKey("");
    setData(null);
    window.sessionStorage.removeItem("ilaw_admin_token");
  }

  async function submitUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage(editingUserId ? "Updating user account..." : "Adding user account...");
    try {
      const action = editingUserId ? "update-user" : "create-user";
      const payload = {
        label: userForm.label,
        email: userForm.email,
        accessKey: userForm.accessKey,
        authProvider: userForm.authProvider,
        creditLimit: userForm.creditLimit === "" ? null : Number(userForm.creditLimit),
        creditsUsed: Number(userForm.creditsUsed || 0),
        pptCreditLimit: userForm.pptCreditLimit === "" ? null : Number(userForm.pptCreditLimit),
        pptCreditsUsed: Number(userForm.pptCreditsUsed || 0),
        lasHeaderDivision: userForm.lasHeaderDivision,
        lasHeaderSchoolName: userForm.lasHeaderSchoolName,
        textModel: userForm.textModel,
        textApiKey: userForm.textApiKey,
        textBaseUrl: userForm.textBaseUrl,
        isActive: userForm.isActive,
        notes: userForm.notes
      };
      await adminFetch(editingUserId ? { action, id: editingUserId, payload } : { action, payload });
      setUserForm(emptyUserForm);
      setEditingUserId(null);
      setMessage(editingUserId ? "User key updated." : "User key added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save user account.");
    } finally {
      setIsLoading(false);
    }
  }

  async function submitApiKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage(editingApiKeyId ? "Updating rotating API key..." : "Adding rotating API key...");
    try {
      const action = editingApiKeyId ? "update-api-key" : "create-api-key";
      const payload = {
        label: apiKeyForm.label,
        provider: apiKeyForm.provider,
        apiKey: apiKeyForm.apiKey,
        model: apiKeyForm.model,
        baseUrl: apiKeyForm.baseUrl,
        priority: Number(apiKeyForm.priority || 100),
        isActive: apiKeyForm.isActive
      };
      await adminFetch(editingApiKeyId ? { action, id: editingApiKeyId, payload } : { action, payload });
      setApiKeyForm(emptyApiKeyForm);
      setEditingApiKeyId(null);
      setMessage(editingApiKeyId ? "Rotating API key updated." : "Rotating API key added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save rotating API key.");
    } finally {
      setIsLoading(false);
    }
  }

  async function submitGammaKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage(editingGammaKeyId ? "Updating Gamma API key..." : "Adding Gamma API key...");
    try {
      const action = editingGammaKeyId ? "update-gamma-key" : "create-gamma-key";
      const payload = {
        label: gammaKeyForm.label,
        apiKey: gammaKeyForm.apiKey,
        priority: Number(gammaKeyForm.priority || 100),
        isActive: gammaKeyForm.isActive
      };
      await adminFetch(editingGammaKeyId ? { action, id: editingGammaKeyId, payload } : { action, payload });
      setGammaKeyForm(emptyGammaKeyForm);
      setEditingGammaKeyId(null);
      setMessage(editingGammaKeyId ? "Gamma API key updated." : "Gamma API key added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save Gamma API key.");
    } finally {
      setIsLoading(false);
    }
  }

  async function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage("Saving global settings...");
    try {
      await adminFetch({ action: "update-settings", payload: {
        ...settingsForm,
        maintenanceUntil: fromDateTimeLocalValue(settingsForm.maintenanceUntil),
        defaultLessonCreditLimit: Number(settingsForm.defaultLessonCreditLimit || 0),
        defaultPptCreditLimit: Number(settingsForm.defaultPptCreditLimit || 0)
      } });
      setMessage("Global settings saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save global settings.");
    } finally {
      setIsLoading(false);
    }
  }

  async function runAction(body: unknown, success: string) {
    setIsLoading(true);
    setMessage("Updating database...");
    try {
      await adminFetch(body);
      setMessage(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Admin action failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function exportBackup() {
    setIsLoading(true);
    setMessage("Preparing CSV backup file...");
    try {
      const response = await fetch("/api/admin/backup-csv", {
        method: "GET",
        headers: {
          "X-Admin-Token": adminKey
        },
        cache: "no-store"
      });
      const csv = await response.text();
      if (!response.ok) {
        let errorMessage = "Unable to export CSV backup.";
        try {
          const parsed = JSON.parse(csv) as { error?: string };
          errorMessage = parsed.error || errorMessage;
        } catch {
          errorMessage = csv || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const safeDate = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `classroom-design-suite-admin-backup-${safeDate}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage("CSV backup exported. Keep the file secure because it contains account data and API keys.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to export CSV backup.");
    } finally {
      setIsLoading(false);
    }
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBackupFileName(file.name);

    if (restoreMode === "replace" && !window.confirm("Replace all current user accounts, text API keys, Gamma API keys, and global settings with this CSV backup?")) {
      event.target.value = "";
      return;
    }

    setIsLoading(true);
    setMessage("Reading CSV backup file...");
    try {
      const csv = await file.text();
      const response = await fetch("/api/admin/backup-csv", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": adminKey
        },
        body: JSON.stringify({ mode: restoreMode, csv })
      });
      const nextData = await response.json();
      if (!response.ok) {
        throw new Error(nextData.error || "Unable to import CSV backup.");
      }
      setData(nextData);
      const restored = nextData.backupRestore;
      setMessage(`CSV backup restored: ${restored?.usersImported ?? 0} user record(s), ${restored?.apiKeysImported ?? 0} text API key(s), ${restored?.gammaKeysImported ?? 0} Gamma key(s), and global settings.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to import CSV backup file.");
    } finally {
      setIsLoading(false);
      event.target.value = "";
    }
  }

  if (!authorized) {
    return (
      <main className="admin-login-shell admin-login-shell-pro">
        <section className="admin-login-card admin-login-card-pro">
          <Link className="admin-back-link" href="/">
            <ArrowLeft size={16} /> Back to landing page
          </Link>
          <div className="admin-login-icon">
            <ShieldCheck size={34} />
          </div>
          <h1>Admin Panel</h1>
          <p>Manage users, credits, text model keys, Gamma keys, LAS headers, and CSV backups.</p>
          <form onSubmit={login}>
            <label htmlFor="admin-key">Admin key</label>
            <input
              id="admin-key"
              type="password"
              value={adminKey}
              onChange={(event) => setAdminKey(event.target.value)}
              placeholder="Enter your secure admin key"
              autoComplete="off"
            />
            <button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 size={18} className="spin" /> : <KeyRound size={18} />}
              Open Admin Panel
            </button>
          </form>
          {message ? <div className="admin-message">{message}</div> : null}
          <small>Local development fallback key: <code>local-admin</code>. Set <code>ILAW_ADMIN_KEY</code> before production.</small>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell admin-shell-pro">
      <header className="admin-command-center">
        <div className="admin-command-copy">
          <Link className="admin-back-link" href="/">
            <ArrowLeft size={16} /> Main system
          </Link>
          <div className="admin-badge"><ShieldCheck size={16} /> Secure Admin Control Center</div>
          <h1><Database size={34} /> Admin Panel</h1>
          <p>Manage access, credits, model routing, presentation keys, and school defaults from one dashboard.</p>
        </div>
        <div className="admin-command-side">
          <div className="admin-orbit-card" aria-hidden="true">
            <span className="admin-orbit-dot one" />
            <span className="admin-orbit-dot two" />
            <span className="admin-orbit-dot three" />
            <Database size={28} />
          </div>
          <div className="admin-header-actions">
            <button type="button" onClick={() => loadAdminData()} disabled={isLoading}>
              {isLoading ? <Loader2 size={17} className="spin" /> : <RefreshCcw size={17} />} Refresh
            </button>
            <button type="button" className="ghost-danger" onClick={signOut}>Sign out</button>
          </div>
        </div>
      </header>

      {message ? <div className={`admin-banner ${data?.configured ? "ok" : "warn"}`}>{message}</div> : null}

      <section className="admin-stats-grid admin-stats-grid-pro">
        <div className="admin-stat-card"><Users size={20} /><span>Total users</span><strong>{data?.stats.totalUsers ?? 0}</strong></div>
        <div className="admin-stat-card"><CheckCircle2 size={20} /><span>Active users</span><strong>{data?.stats.activeUsers ?? 0}</strong></div>
        <div className="admin-stat-card"><Activity size={20} /><span>Lesson/LAS used</span><strong>{data?.stats.totalTextCreditsUsed ?? 0}</strong></div>
        <div className="admin-stat-card"><Activity size={20} /><span>PPT used</span><strong>{data?.stats.totalPptCreditsUsed ?? 0}</strong></div>
        <div className="admin-stat-card"><KeyRound size={20} /><span>Text keys</span><strong>{data?.stats.activeApiKeys ?? 0}</strong></div>
        <div className="admin-stat-card"><KeyRound size={20} /><span>Gamma keys</span><strong>{data?.stats.activeGammaApiKeys ?? 0}</strong></div>
      </section>

      {creditRiskUsers.length ? (
        <section className="admin-alert-card">
          <strong>{creditRiskUsers.length} user{creditRiskUsers.length === 1 ? "" : "s"} reached a credit limit</strong>
          <span>{creditRiskUsers.map((user) => user.label).join(", ")}</span>
        </section>
      ) : null}

      <section className="admin-workbench">
        <nav className="admin-tabs" aria-label="Admin sections">
          <button
            type="button"
            className={`admin-tab-button ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            <Users size={18} />
            <span>User accounts</span>
            <small>{data?.users.length ?? 0} records</small>
          </button>
          <button
            type="button"
            className={`admin-tab-button ${activeTab === "api-keys" ? "active" : ""}`}
            onClick={() => setActiveTab("api-keys")}
          >
            <KeyRound size={18} />
            <span>Rotating API keys</span>
            <small>{data?.textApiKeys.length ?? 0} keys</small>
          </button>
          <button
            type="button"
            className={`admin-tab-button ${activeTab === "gamma-keys" ? "active" : ""}`}
            onClick={() => setActiveTab("gamma-keys")}
          >
            <KeyRound size={18} />
            <span>Gamma API keys</span>
            <small>{data?.gammaApiKeys.length ?? 0} keys</small>
          </button>
          <button
            type="button"
            className={`admin-tab-button ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            <Settings size={18} />
            <span>Global settings</span>
            <small>Defaults</small>
          </button>
        </nav>

        <section className="admin-backup-strip" aria-label="Backup and restore">
          <div>
            <span>Backup Center</span>
            <h3>Export or restore admin records</h3>
            <p>Download or restore user accounts, credit limits, dedicated model keys, Gamma keys, global settings, and rotating API keys in one editable CSV file.</p>
          </div>
          <div className="admin-backup-actions">
            <select value={restoreMode} onChange={(event) => setRestoreMode(event.target.value as "merge" | "replace")} disabled={isLoading}>
              <option value="merge">Merge / update</option>
              <option value="replace">Replace all</option>
            </select>
            <button type="button" onClick={exportBackup} disabled={isLoading}>
              <Download size={17} /> Export CSV
            </button>
            <label className="admin-import-button">
              <Upload size={17} /> Import CSV
              <input type="file" accept=".csv,text/csv" onChange={importBackup} disabled={isLoading} />
            </label>
            {backupFileName ? <small>{backupFileName}</small> : null}
          </div>
        </section>

        <div className="admin-panel-intro">
          <div>
            <span>{tabCopy.eyebrow}</span>
            <h2>{tabCopy.title}</h2>
            <p>{tabCopy.description}</p>
          </div>
        </div>

        {activeTab === "users" ? (
          <section className="admin-tab-panel">
            <div className="admin-workspace-grid">
              <div className="admin-card admin-form-card">
                <div className="admin-card-title">
                  <div><h3>{editingUserId ? "Edit user account" : "Add user account"}</h3><p>Approve users, manage limits, and keep optional override credentials in one profile.</p></div>
                </div>
                <form className="admin-form-grid admin-form-grid-pro" onSubmit={submitUser}>
                  <label>Full name<input value={userForm.label} onChange={(event) => setUserForm({ ...userForm, label: event.target.value })} placeholder="Teacher Juan" /></label>
                  <label>Email<input value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} placeholder="teacher@school.edu" /></label>
                  <label>Internal access token<input value={userForm.accessKey} onChange={(event) => setUserForm({ ...userForm, accessKey: event.target.value })} placeholder="Auto-generated when empty" /></label>
                  <label>Auth provider<input value={userForm.authProvider} onChange={(event) => setUserForm({ ...userForm, authProvider: event.target.value })} placeholder="email or google" /></label>
                  <label>Lesson/LAS credit limit<input type="number" min="0" value={userForm.creditLimit} onChange={(event) => setUserForm({ ...userForm, creditLimit: event.target.value })} placeholder="100" /></label>
                  <label>Lesson/LAS used<input type="number" min="0" value={userForm.creditsUsed} onChange={(event) => setUserForm({ ...userForm, creditsUsed: event.target.value })} /></label>
                  <label>PPT credit limit<input type="number" min="0" value={userForm.pptCreditLimit} onChange={(event) => setUserForm({ ...userForm, pptCreditLimit: event.target.value })} placeholder="20" /></label>
                  <label>PPT used<input type="number" min="0" value={userForm.pptCreditsUsed} onChange={(event) => setUserForm({ ...userForm, pptCreditsUsed: event.target.value })} /></label>
                  <label>LAS Division override<input value={userForm.lasHeaderDivision} onChange={(event) => setUserForm({ ...userForm, lasHeaderDivision: event.target.value })} placeholder="Empty = global Division" /></label>
                  <label>LAS School override<input value={userForm.lasHeaderSchoolName} onChange={(event) => setUserForm({ ...userForm, lasHeaderSchoolName: event.target.value })} placeholder="Empty = global School" /></label>
                  <label>Text model override<input value={userForm.textModel} onChange={(event) => setUserForm({ ...userForm, textModel: event.target.value })} placeholder="Empty = global model" /></label>
                  <label>Text base URL override<input value={userForm.textBaseUrl} onChange={(event) => setUserForm({ ...userForm, textBaseUrl: event.target.value })} placeholder="Empty = global base URL" /></label>
                  <label className="admin-wide">Dedicated API key<textarea value={userForm.textApiKey} onChange={(event) => setUserForm({ ...userForm, textApiKey: event.target.value })} placeholder="Empty = use rotating global keys" /></label>
                  <label className="admin-wide">Notes<textarea value={userForm.notes} onChange={(event) => setUserForm({ ...userForm, notes: event.target.value })} placeholder="Optional admin notes" /></label>
                  <label className="admin-check"><input type="checkbox" checked={userForm.isActive} onChange={(event) => setUserForm({ ...userForm, isActive: event.target.checked })} /> Approved / active account</label>
                  <div className="admin-form-actions">
                    <button type="submit" disabled={isLoading}>{editingUserId ? <Save size={17} /> : <Plus size={17} />}{editingUserId ? "Save account" : "Add account"}</button>
                    {editingUserId ? <button type="button" onClick={() => { setEditingUserId(null); setUserForm(emptyUserForm); }}>Cancel</button> : null}
                  </div>
                </form>
              </div>

              <div className="admin-card admin-data-card">
                <div className="admin-table-header">
                  <div><h3>User accounts</h3><p>New Google/email signups appear here as inactive until approved.</p></div>
                </div>
                <div className="admin-table-wrap admin-table-wrap-pro">
                  <table className="admin-table admin-table-pro">
                    <thead><tr><th>Account</th><th>Lesson/LAS</th><th>PPT</th><th>Model access</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {(data?.users || []).map((user) => (
                        <tr key={user.id}>
                          <td><strong>{user.label}</strong><small>{user.email || "No email set"}</small><small>{user.authProvider || "email"} · Last used: {dateLabel(user.lastUsedAt)}</small></td>
                          <td><strong>{user.creditsUsed} / {user.creditLimit === null ? "∞" : user.creditLimit}</strong><small>Lesson plan + LAS</small></td>
                          <td><strong>{user.pptCreditsUsed} / {user.pptCreditLimit === null ? "∞" : user.pptCreditLimit}</strong><small>Presentation generator</small></td>
                          <td><small>{maskKey(user.textApiKey)}</small><small>{user.textModel || "Global model"}</small><small>{user.textBaseUrl || "Global base URL"}</small><small>LAS: {user.lasHeaderSchoolName || "Global school"}</small></td>
                          <td><span className={`admin-pill ${user.isActive ? "active" : "off"}`}>{user.isActive ? "Approved" : "Pending"}</span></td>
                          <td>
                            <div className="admin-row-actions">
                              <button type="button" onClick={() => { setEditingUserId(user.id); setUserForm(userToForm(user)); }}>Edit</button>
                              <button type="button" onClick={() => runAction({ action: "reset-user-credits", id: user.id }, "User credit counters reset.")}><RotateCcw size={15} /> Reset</button>
                              <button type="button" className="danger" onClick={() => runAction({ action: "delete-user", id: user.id }, "User key deleted.")}><Trash2 size={15} /> Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {data?.users.length === 0 ? <tr><td colSpan={6}>No user accounts yet.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        ) : activeTab === "api-keys" ? (
          <section className="admin-tab-panel">
            <div className="admin-workspace-grid">
              <div className="admin-card admin-form-card">
                <div className="admin-card-title">
                  <div><h3>{editingApiKeyId ? "Edit rotating key" : "Add rotating key"}</h3><p>Use OpenAI-compatible providers, including Gemini through an OpenAI-compatible base URL.</p></div>
                </div>
                <form className="admin-form-grid admin-form-grid-pro" onSubmit={submitApiKey}>
                  <label>Label<input value={apiKeyForm.label} onChange={(event) => setApiKeyForm({ ...apiKeyForm, label: event.target.value })} placeholder="OpenAI Key 1" /></label>
                  <label>Provider<input value={apiKeyForm.provider} onChange={(event) => setApiKeyForm({ ...apiKeyForm, provider: event.target.value })} placeholder="OpenAI compatible" /></label>
                  <label>Model<input value={apiKeyForm.model} onChange={(event) => setApiKeyForm({ ...apiKeyForm, model: event.target.value })} placeholder="Empty = OPENAI_MODEL" /></label>
                  <label>Priority<input type="number" value={apiKeyForm.priority} onChange={(event) => setApiKeyForm({ ...apiKeyForm, priority: event.target.value })} /></label>
                  <label className="admin-wide">Base URL<input value={apiKeyForm.baseUrl} onChange={(event) => setApiKeyForm({ ...apiKeyForm, baseUrl: event.target.value })} placeholder="Empty = OPENAI_BASE_URL" /></label>
                  <label className="admin-wide">API key<textarea value={apiKeyForm.apiKey} onChange={(event) => setApiKeyForm({ ...apiKeyForm, apiKey: event.target.value })} placeholder="sk-..." /></label>
                  <label className="admin-check"><input type="checkbox" checked={apiKeyForm.isActive} onChange={(event) => setApiKeyForm({ ...apiKeyForm, isActive: event.target.checked })} /> Active key</label>
                  <div className="admin-form-actions">
                    <button type="submit" disabled={isLoading}>{editingApiKeyId ? <Save size={17} /> : <Plus size={17} />}{editingApiKeyId ? "Save API key" : "Add API key"}</button>
                    {editingApiKeyId ? <button type="button" onClick={() => { setEditingApiKeyId(null); setApiKeyForm(emptyApiKeyForm); }}>Cancel</button> : null}
                  </div>
                </form>
              </div>

              <div className="admin-card admin-data-card">
                <div className="admin-table-header">
                  <div><h3>Rotation queue</h3><p>Active keys are selected by priority, least use, and oldest use.</p></div>
                </div>
                <div className="admin-table-wrap admin-table-wrap-pro">
                  <table className="admin-table admin-table-pro">
                    <thead><tr><th>Key</th><th>Model</th><th>Base URL</th><th>Rotation</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {(data?.textApiKeys || []).map((key) => (
                        <tr key={key.id}>
                          <td><strong>{key.label}</strong><small>{maskKey(key.apiKey)}</small><small>{key.provider}</small></td>
                          <td><strong>{key.model || "Global model"}</strong></td>
                          <td><small>{key.baseUrl || "Global base URL"}</small></td>
                          <td><small>Priority {key.priority}</small><small>Used {key.useCount}x</small><small>Last: {dateLabel(key.lastUsedAt)}</small></td>
                          <td><span className={`admin-pill ${key.isActive ? "active" : "off"}`}>{key.isActive ? "Active" : "Inactive"}</span></td>
                          <td>
                            <div className="admin-row-actions">
                              <button type="button" onClick={() => { setEditingApiKeyId(key.id); setApiKeyForm(apiKeyToForm(key)); }}>Edit</button>
                              <button type="button" className="danger" onClick={() => runAction({ action: "delete-api-key", id: key.id }, "API key deleted.")}><Trash2 size={15} /> Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {data?.textApiKeys.length === 0 ? <tr><td colSpan={6}>No global rotating keys yet. Add at least one key or set OPENAI_API_KEY.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        ) : activeTab === "gamma-keys" ? (
          <section className="admin-tab-panel">
            <div className="admin-workspace-grid">
              <div className="admin-card admin-form-card">
                <div className="admin-card-title">
                  <div><h3>{editingGammaKeyId ? "Edit Gamma key" : "Add Gamma key"}</h3><p>Store Gamma keys in Admin. PPT jobs rotate active keys by priority and least use.</p></div>
                </div>
                <form className="admin-form-grid admin-form-grid-pro" onSubmit={submitGammaKey}>
                  <label>Label<input value={gammaKeyForm.label} onChange={(event) => setGammaKeyForm({ ...gammaKeyForm, label: event.target.value })} placeholder="Gamma Key 1" /></label>
                  <label>Priority<input type="number" value={gammaKeyForm.priority} onChange={(event) => setGammaKeyForm({ ...gammaKeyForm, priority: event.target.value })} /></label>
                  <label className="admin-wide">Gamma API key<textarea value={gammaKeyForm.apiKey} onChange={(event) => setGammaKeyForm({ ...gammaKeyForm, apiKey: event.target.value })} placeholder="Paste Gamma API key" /></label>
                  <label className="admin-check"><input type="checkbox" checked={gammaKeyForm.isActive} onChange={(event) => setGammaKeyForm({ ...gammaKeyForm, isActive: event.target.checked })} /> Active key</label>
                  <div className="admin-form-actions">
                    <button type="submit" disabled={isLoading}>{editingGammaKeyId ? <Save size={17} /> : <Plus size={17} />}{editingGammaKeyId ? "Save Gamma key" : "Add Gamma key"}</button>
                    {editingGammaKeyId ? <button type="button" onClick={() => { setEditingGammaKeyId(null); setGammaKeyForm(emptyGammaKeyForm); }}>Cancel</button> : null}
                  </div>
                </form>
              </div>

              <div className="admin-card admin-data-card">
                <div className="admin-table-header">
                  <div><h3>Gamma rotation queue</h3><p>Presentation jobs use these keys. Status checks reuse the same key assigned to the generation.</p></div>
                </div>
                <div className="admin-table-wrap admin-table-wrap-pro">
                  <table className="admin-table admin-table-pro">
                    <thead><tr><th>Key</th><th>Rotation</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {(data?.gammaApiKeys || []).map((key) => (
                        <tr key={key.id}>
                          <td><strong>{key.label}</strong><small>{maskKey(key.apiKey)}</small><small>Gamma presentation API</small></td>
                          <td><small>Priority {key.priority}</small><small>Used {key.useCount}x</small><small>Last: {dateLabel(key.lastUsedAt)}</small></td>
                          <td><span className={`admin-pill ${key.isActive ? "active" : "off"}`}>{key.isActive ? "Active" : "Inactive"}</span></td>
                          <td>
                            <div className="admin-row-actions">
                              <button type="button" onClick={() => { setEditingGammaKeyId(key.id); setGammaKeyForm(gammaKeyToForm(key)); }}>Edit</button>
                              <button type="button" className="danger" onClick={() => runAction({ action: "delete-gamma-key", id: key.id }, "Gamma API key deleted.")}><Trash2 size={15} /> Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {data?.gammaApiKeys.length === 0 ? <tr><td colSpan={4}>No Gamma keys yet. Add at least one key before using the PPT Generator.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="admin-tab-panel">
            <div className="admin-workspace-grid">
              <div className="admin-card admin-form-card">
                <div className="admin-card-title">
                  <div><h3>Global defaults</h3><p>These values apply to every user unless a user profile has its own override.</p></div>
                </div>
                <form className="admin-form-grid admin-form-grid-pro" onSubmit={submitSettings}>
                  <label>New signup Lesson/LAS credits<input type="number" min="0" value={settingsForm.defaultLessonCreditLimit} onChange={(event) => setSettingsForm({ ...settingsForm, defaultLessonCreditLimit: event.target.value })} placeholder="100" /></label>
                  <label>New signup PPT credits<input type="number" min="0" value={settingsForm.defaultPptCreditLimit} onChange={(event) => setSettingsForm({ ...settingsForm, defaultPptCreditLimit: event.target.value })} placeholder="20" /></label>
                  <label className="admin-wide">Default LAS Division<input value={settingsForm.lasHeaderDivision} onChange={(event) => setSettingsForm({ ...settingsForm, lasHeaderDivision: event.target.value })} placeholder="Division of General Santos City" /></label>
                  <label className="admin-wide">Default LAS School Name<input value={settingsForm.lasHeaderSchoolName} onChange={(event) => setSettingsForm({ ...settingsForm, lasHeaderSchoolName: event.target.value })} placeholder="GENERAL SANTOS CITY NATIONAL HIGH SCHOOL" /></label>
                  <label className="admin-wide">Gamma API Base URL<input value={settingsForm.gammaApiBaseUrl} onChange={(event) => setSettingsForm({ ...settingsForm, gammaApiBaseUrl: event.target.value })} placeholder="https://public-api.gamma.app/v1.0" /></label>
                  <label className="admin-check admin-wide"><input type="checkbox" checked={settingsForm.allowNewSignups} onChange={(event) => setSettingsForm({ ...settingsForm, allowNewSignups: event.target.checked })} /> Allow new Google and email signups</label>
                  <label className="admin-check admin-wide"><input type="checkbox" checked={settingsForm.maintenanceModeEnabled} onChange={(event) => setSettingsForm({ ...settingsForm, maintenanceModeEnabled: event.target.checked })} /> Show maintenance mode on the public landing page</label>
                  <label className="admin-wide">Maintenance end time<input type="datetime-local" value={settingsForm.maintenanceUntil} onChange={(event) => setSettingsForm({ ...settingsForm, maintenanceUntil: event.target.value })} /></label>
                  <label className="admin-wide">Maintenance message<textarea value={settingsForm.maintenanceMessage} onChange={(event) => setSettingsForm({ ...settingsForm, maintenanceMessage: event.target.value })} placeholder="We are improving Classroom Design Suite. Please check back soon." /></label>
                  <div className="admin-form-actions">
                    <button type="submit" disabled={isLoading}><Save size={17} /> Save settings</button>
                  </div>
                </form>
              </div>

              <div className="admin-card admin-data-card">
                <div className="admin-table-header">
                  <div><h3>How overrides work</h3><p>Use this order for LAS headers and Gamma service access.</p></div>
                </div>
                <div className="admin-help-list">
                  <div><strong>LAS Division</strong><span>User override → Global default → generated content fallback.</span></div>
                  <div><strong>LAS School</strong><span>User override → Global default → lesson input fallback.</span></div>
                  <div><strong>New signup credits</strong><span>Google and verified email accounts receive the default Lesson/LAS and PPT limits set here.</span></div>
                  <div><strong>Registration control</strong><span>Turn off new signup when you want only existing approved users to access the system.</span></div>
                  <div><strong>Maintenance mode</strong><span>Show a polished public notice with a return time while keeping the Admin Panel accessible.</span></div>
                  <div><strong>Gamma API</strong><span>Active Admin Gamma key → .env fallback only when no Admin key exists.</span></div>
                  <div><strong>PPT Credits</strong><span>Deducted from actual Gamma usage when the job reports credits used.</span></div>
                </div>
              </div>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
