/**
 * Admin panel: Concierge Knowledge Base.
 *
 * Full CRUD on public.concierge_knowledge rows plus CSV template download,
 * bulk export of current knowledge, and bulk CSV upload (append/replace).
 * Every write goes through server functions gated by the admin passkey and
 * uses the service-role client — no writes come from the browser.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  Save,
  Trash2,
  Edit2,
  Download,
  Upload,
  Loader2,
  X,
  Check,
  AlertTriangle,
  FileText,
} from "lucide-react";
import { useSite } from "../context/SiteContext";
import {
  listKnowledge,
  upsertKnowledge,
  deleteKnowledge,
  bulkImportKnowledge,
} from "../admin.functions";

interface KnowledgeRow {
  id: string;
  topic: string;
  label: string;
  body: string;
  tags: string[];
  enabled: boolean;
  sort_order: number;
  updated_at?: string;
}

interface DraftEntry {
  id?: string;
  topic: string;
  label: string;
  body: string;
  tagsText: string;
  enabled: boolean;
  sort_order: number;
}

const EMPTY_DRAFT: DraftEntry = {
  topic: "",
  label: "",
  body: "",
  tagsText: "",
  enabled: true,
  sort_order: 0,
};

// ─── CSV helpers ────────────────────────────────────────────────────────────
function csvEscape(v: string): string {
  if (v == null) return "";
  const needsQuote = /[",\n\r]/.test(v);
  const s = v.replace(/"/g, '""');
  return needsQuote ? `"${s}"` : s;
}

function rowsToCsv(rows: KnowledgeRow[]): string {
  const header = "topic,label,body,tags,enabled,sort_order";
  const lines = rows.map((r) =>
    [
      csvEscape(r.topic),
      csvEscape(r.label),
      csvEscape(r.body),
      csvEscape((r.tags || []).join(";")),
      r.enabled ? "true" : "false",
      String(r.sort_order ?? 0),
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

/** Minimal RFC-4180 CSV parser (double-quote escapes, comma/newline delims). */
function parseCsv(input: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;
  const src = input.replace(/\r\n?/g, "\n");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(cur);
        cur = "";
      } else if (ch === "\n") {
        row.push(cur);
        out.push(row);
        row = [];
        cur = "";
      } else {
        cur += ch;
      }
    }
  }
  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    out.push(row);
  }
  return out.filter((r) => r.length > 0 && !(r.length === 1 && r[0] === ""));
}

function downloadFile(filename: string, content: string, mime = "text/csv") {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const TEMPLATE_CSV = [
  "topic,label,body,tags,enabled,sort_order",
  `breakfast,"Breakfast hours","Breakfast is served 08:30–10:30 daily. Continental, Full English, and Asian options are cooked to order.","breakfast;dining;hours",true,10`,
  `airport-van,"Airport transfer","Private air-conditioned van transfer between Puerto Princesa and BAIA. Book at least 48 hours ahead. Journey time ~4 hours.","transfer;airport;van;pickup",true,20`,
].join("\n");

export default function KnowledgeManager() {
  const { adminPasskey } = useSite();
  const [rows, setRows] = useState<KnowledgeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<DraftEntry | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Bulk import state
  const [importOpen, setImportOpen] = useState(false);
  const [importMode, setImportMode] = useState<"append" | "replace">("append");
  const [importPreview, setImportPreview] = useState<{
    fileName: string;
    entries: Array<Omit<DraftEntry, "tagsText"> & { tags: string[] }>;
    skipped: number;
  } | null>(null);
  const [replaceConfirm, setReplaceConfirm] = useState("");
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    if (!adminPasskey) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listKnowledge({ data: { passkey: adminPasskey } });
      setRows((res.rows as KnowledgeRow[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [adminPasskey]);

  useEffect(() => {
    void load();
  }, [load]);

  const flash = (msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(null), 3000);
  };

  const startNew = () => setEditing({ ...EMPTY_DRAFT });
  const startEdit = (r: KnowledgeRow) =>
    setEditing({
      id: r.id,
      topic: r.topic,
      label: r.label,
      body: r.body,
      tagsText: (r.tags || []).join(", "),
      enabled: r.enabled,
      sort_order: r.sort_order ?? 0,
    });

  const saveDraft = async () => {
    if (!editing || !adminPasskey) return;
    setSaving(true);
    setError(null);
    try {
      const tags = editing.tagsText
        .split(/[,;]/)
        .map((t) => t.trim())
        .filter(Boolean);
      await upsertKnowledge({
        data: {
          passkey: adminPasskey,
          entry: {
            id: editing.id,
            topic: editing.topic,
            label: editing.label,
            body: editing.body,
            tags,
            enabled: editing.enabled,
            sort_order: editing.sort_order,
          },
        },
      });
      setEditing(null);
      await load();
      flash(editing.id ? "Entry updated." : "Entry added.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async (id: string) => {
    if (!adminPasskey) return;
    setError(null);
    try {
      await deleteKnowledge({ data: { passkey: adminPasskey, id } });
      setConfirmDeleteId(null);
      await load();
      flash("Entry deleted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const toggleEnabled = async (r: KnowledgeRow) => {
    if (!adminPasskey) return;
    try {
      await upsertKnowledge({
        data: {
          passkey: adminPasskey,
          entry: {
            id: r.id,
            topic: r.topic,
            label: r.label,
            body: r.body,
            tags: r.tags,
            enabled: !r.enabled,
            sort_order: r.sort_order,
          },
        },
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const downloadTemplate = () =>
    downloadFile("baia-concierge-knowledge-template.csv", TEMPLATE_CSV);

  const downloadBackup = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`baia-concierge-knowledge-${stamp}.csv`, rowsToCsv(rows));
  };

  const handleImportFile = async (file: File) => {
    setError(null);
    setImportPreview(null);
    setReplaceConfirm("");
    try {
      const text = await file.text();
      const table = parseCsv(text);
      if (table.length < 2) {
        throw new Error("CSV appears empty (needs a header row and at least one data row).");
      }
      const header = table[0].map((c) => c.trim().toLowerCase());
      const iTopic = header.indexOf("topic");
      const iLabel = header.indexOf("label");
      const iBody = header.indexOf("body");
      const iTags = header.indexOf("tags");
      const iEnabled = header.indexOf("enabled");
      const iSort = header.indexOf("sort_order");
      if (iTopic < 0 || iLabel < 0 || iBody < 0) {
        throw new Error("CSV header must include at least: topic, label, body");
      }
      const entries: Array<Omit<DraftEntry, "tagsText"> & { tags: string[] }> = [];
      let skipped = 0;
      for (let r = 1; r < table.length; r++) {
        const row = table[r];
        const topic = (row[iTopic] || "").trim();
        const label = (row[iLabel] || "").trim();
        const body = (row[iBody] || "").trim();
        if (!topic || !label || !body) {
          skipped++;
          continue;
        }
        const tags =
          iTags >= 0
            ? (row[iTags] || "")
                .split(/[;,]/)
                .map((t) => t.trim())
                .filter(Boolean)
            : [];
        const enabled =
          iEnabled >= 0 ? !/^(false|no|0|off)$/i.test((row[iEnabled] || "").trim()) : true;
        const sort_order = iSort >= 0 ? Number(row[iSort]) || 0 : 0;
        entries.push({ topic, label, body, tags, enabled, sort_order });
      }
      if (entries.length === 0) throw new Error("No valid rows found in the CSV.");
      setImportPreview({ fileName: file.name, entries, skipped });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const runImport = async () => {
    if (!importPreview || !adminPasskey) return;
    if (importMode === "replace" && replaceConfirm !== "REPLACE") {
      setError('Type REPLACE (all caps) to confirm a destructive replace.');
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const res = await bulkImportKnowledge({
        data: {
          passkey: adminPasskey,
          entries: importPreview.entries.map((e) => ({
            topic: e.topic,
            label: e.label,
            body: e.body,
            tags: e.tags,
            enabled: e.enabled,
            sort_order: e.sort_order,
          })),
          mode: importMode,
        },
      });
      setImportPreview(null);
      setImportOpen(false);
      setReplaceConfirm("");
      await load();
      flash(`Imported ${res.inserted} entr${res.inserted === 1 ? "y" : "ies"} (${res.mode}).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  };

  const sortedRows = useMemo(
    () =>
      [...rows].sort(
        (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.label.localeCompare(b.label),
      ),
    [rows],
  );

  return (
    <div className="space-y-6 text-left">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-xl font-serif text-luxury-100 uppercase tracking-wider mb-1">
            Knowledge Base
          </h3>
          <p className="text-xs text-luxury-400 font-sans font-light max-w-2xl">
            Everything the concierge knows about BAIA. Add, edit, or delete entries here — updates
            go live immediately. Bulk-download to back up, or bulk-upload a filled-in template.
            Prices are automatically stripped before the bot ever sees the text.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={downloadTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-luxury-800 text-luxury-200 rounded-sm text-[10px] uppercase tracking-wider hover:border-gold-300 cursor-pointer"
          >
            <FileText size={13} /> Template
          </button>
          <button
            onClick={downloadBackup}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-luxury-800 text-luxury-200 rounded-sm text-[10px] uppercase tracking-wider hover:border-gold-300 cursor-pointer disabled:opacity-40"
          >
            <Download size={13} /> Download all
          </button>
          <button
            onClick={() => {
              setImportOpen(true);
              setImportPreview(null);
              setError(null);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-luxury-800 text-luxury-200 rounded-sm text-[10px] uppercase tracking-wider hover:border-gold-300 cursor-pointer"
          >
            <Upload size={13} /> Bulk upload
          </button>
          <button
            onClick={startNew}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gold-500 hover:bg-gold-600 text-white rounded-sm text-[10px] uppercase tracking-widest font-bold cursor-pointer"
          >
            <Plus size={13} /> Add entry
          </button>
        </div>
      </div>

      {status && (
        <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-sans bg-emerald-500/5 border border-emerald-500/20 p-3 rounded">
          <Check size={14} />
          <span>{status}</span>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 text-[11px] text-amber-400 font-sans bg-amber-500/5 border border-amber-500/20 p-3 rounded">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-luxury-400 text-xs font-sans">
          <Loader2 size={14} className="animate-spin" /> Loading knowledge…
        </div>
      ) : sortedRows.length === 0 ? (
        <div className="bg-luxury-950 border border-luxury-900 p-6 rounded-sm text-center text-luxury-400 text-xs font-sans">
          No knowledge entries yet. Click <span className="text-gold-300">Add entry</span> to create
          the first one, or download the template and bulk-upload.
        </div>
      ) : (
        <div className="space-y-2">
          {sortedRows.map((r) => (
            <div
              key={r.id}
              className={`bg-luxury-950 border rounded-sm p-4 flex flex-col sm:flex-row sm:items-start gap-3 ${
                r.enabled ? "border-luxury-900" : "border-luxury-900/50 opacity-60"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-sm font-serif text-luxury-100">{r.label}</span>
                  <span className="text-[9px] tracking-widest uppercase text-gold-300 font-sans bg-gold-500/10 px-1.5 py-0.5 rounded">
                    {r.topic}
                  </span>
                  <span className="text-[9px] text-luxury-500 font-sans">
                    order {r.sort_order ?? 0}
                  </span>
                </div>
                <p className="text-xs text-luxury-300 font-sans font-light line-clamp-2 whitespace-pre-wrap">
                  {r.body}
                </p>
                {r.tags?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[9px] text-luxury-400 bg-luxury-900 border border-luxury-800 px-1.5 py-0.5 rounded"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <label className="flex items-center gap-1.5 text-[10px] text-luxury-300 font-sans uppercase tracking-wider cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    onChange={() => toggleEnabled(r)}
                    className="accent-gold-500 w-3.5 h-3.5"
                  />
                  {r.enabled ? "On" : "Off"}
                </label>
                <button
                  onClick={() => startEdit(r)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-luxury-800 text-luxury-200 rounded-sm text-[10px] uppercase tracking-wider hover:border-gold-300 cursor-pointer"
                >
                  <Edit2 size={12} /> Edit
                </button>
                <button
                  onClick={() => setConfirmDeleteId(r.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-red-500/40 text-red-300 rounded-sm text-[10px] uppercase tracking-wider hover:bg-red-500/10 cursor-pointer"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Edit modal ─────────────────────────────────────────────── */}
      {editing && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !saving && setEditing(null)}
        >
          <div
            className="bg-luxury-950 border border-luxury-800 rounded-sm w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-serif uppercase tracking-wider text-luxury-100">
                {editing.id ? "Edit entry" : "New entry"}
              </h4>
              <button
                onClick={() => !saving && setEditing(null)}
                className="text-luxury-400 hover:text-luxury-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-luxury-400 font-sans">
                  Topic (short slug)
                </label>
                <input
                  value={editing.topic}
                  onChange={(e) => setEditing({ ...editing, topic: e.target.value })}
                  placeholder="e.g. airport-van"
                  className="bg-luxury-900 border border-luxury-800 rounded-sm px-3 py-2 text-xs text-luxury-100 focus:outline-none focus:border-gold-300 font-mono"
                />
              </div>
              <div className="flex flex-col space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-luxury-400 font-sans">
                  Label (title shown here)
                </label>
                <input
                  value={editing.label}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                  placeholder="e.g. Airport Transfer"
                  className="bg-luxury-900 border border-luxury-800 rounded-sm px-3 py-2 text-xs text-luxury-100 focus:outline-none focus:border-gold-300"
                />
              </div>
            </div>
            <div className="flex flex-col space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-luxury-400 font-sans">
                Body (the actual answer text)
              </label>
              <textarea
                value={editing.body}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                rows={8}
                placeholder="What should the concierge say when a guest asks about this? Prices are auto-stripped."
                className="bg-luxury-900 border border-luxury-800 rounded-sm px-3 py-2 text-xs text-luxury-100 focus:outline-none focus:border-gold-300 font-sans leading-relaxed"
              />
            </div>
            <div className="flex flex-col space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-luxury-400 font-sans">
                Tags (comma or semicolon separated — helps the bot match guest questions)
              </label>
              <input
                value={editing.tagsText}
                onChange={(e) => setEditing({ ...editing, tagsText: e.target.value })}
                placeholder="airport, transfer, van, pickup"
                className="bg-luxury-900 border border-luxury-800 rounded-sm px-3 py-2 text-xs text-luxury-100 focus:outline-none focus:border-gold-300"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-xs text-luxury-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editing.enabled}
                  onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })}
                  className="accent-gold-500 w-4 h-4"
                />
                <span className="uppercase tracking-wider text-[11px]">
                  {editing.enabled ? "Enabled" : "Disabled"}
                </span>
              </label>
              <div className="flex flex-col space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-luxury-400 font-sans">
                  Sort order
                </label>
                <input
                  type="number"
                  value={editing.sort_order}
                  onChange={(e) =>
                    setEditing({ ...editing, sort_order: Number(e.target.value) || 0 })
                  }
                  className="bg-luxury-900 border border-luxury-800 rounded-sm px-3 py-2 text-xs text-luxury-100 focus:outline-none focus:border-gold-300 font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditing(null)}
                disabled={saving}
                className="px-4 py-2 border border-luxury-800 text-luxury-300 rounded-sm text-[10px] uppercase tracking-wider hover:border-gold-300 cursor-pointer disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={saveDraft}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 bg-gold-500 hover:bg-gold-600 text-white rounded-sm text-[10px] uppercase tracking-widest font-bold cursor-pointer disabled:opacity-40"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                {saving ? "Saving" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete confirm ─────────────────────────────────────────── */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="bg-luxury-950 border border-luxury-800 rounded-sm w-full max-w-md p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-lg font-serif uppercase tracking-wider text-luxury-100">
              Delete this entry?
            </h4>
            <p className="text-xs text-luxury-400 font-sans">
              The concierge will stop using it immediately. This can't be undone — bulk-download
              first if you want a backup.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 border border-luxury-800 text-luxury-300 rounded-sm text-[10px] uppercase tracking-wider hover:border-gold-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => doDelete(confirmDeleteId)}
                className="inline-flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-sm text-[10px] uppercase tracking-widest font-bold cursor-pointer"
              >
                <Trash2 size={13} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Bulk import modal ──────────────────────────────────────── */}
      {importOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !importing && setImportOpen(false)}
        >
          <div
            className="bg-luxury-950 border border-luxury-800 rounded-sm w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-serif uppercase tracking-wider text-luxury-100">
                Bulk upload knowledge
              </h4>
              <button
                onClick={() => !importing && setImportOpen(false)}
                className="text-luxury-400 hover:text-luxury-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-luxury-400 font-sans">
              Download the template first, fill it in, and upload here. CSV columns:{" "}
              <code className="text-luxury-200">topic,label,body,tags,enabled,sort_order</code>.
              Tags are separated by <code className="text-luxury-200">;</code>.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <label className="inline-flex items-center gap-2 px-4 py-2 border border-luxury-800 text-luxury-200 rounded-sm text-[10px] uppercase tracking-wider hover:border-gold-300 cursor-pointer">
                <Upload size={13} /> Choose CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleImportFile(f);
                    e.target.value = "";
                  }}
                />
              </label>
              <div className="flex items-center gap-3 text-[11px] text-luxury-300 font-sans">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="import-mode"
                    checked={importMode === "append"}
                    onChange={() => setImportMode("append")}
                    className="accent-gold-500"
                  />
                  Append
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="import-mode"
                    checked={importMode === "replace"}
                    onChange={() => setImportMode("replace")}
                    className="accent-gold-500"
                  />
                  <span className="text-red-300">Replace all</span>
                </label>
              </div>
            </div>

            {importPreview && (
              <div className="bg-luxury-900/50 border border-luxury-800 rounded-sm p-4 space-y-2">
                <p className="text-xs text-luxury-200 font-sans">
                  <span className="text-gold-300">{importPreview.entries.length}</span> valid
                  entries in <span className="font-mono">{importPreview.fileName}</span>
                  {importPreview.skipped > 0 && (
                    <>
                      {" "}
                      · <span className="text-amber-400">{importPreview.skipped}</span> skipped
                      (missing topic/label/body)
                    </>
                  )}
                </p>
                {importMode === "replace" && (
                  <div className="space-y-2 pt-2 border-t border-luxury-800">
                    <p className="text-[11px] text-red-300 font-sans">
                      Replace will DELETE every existing entry, then insert the CSV rows. Type{" "}
                      <span className="font-mono">REPLACE</span> below to confirm.
                    </p>
                    <input
                      value={replaceConfirm}
                      onChange={(e) => setReplaceConfirm(e.target.value)}
                      placeholder="Type REPLACE"
                      className="w-full bg-luxury-950 border border-red-500/40 rounded-sm px-3 py-2 text-xs text-luxury-100 focus:outline-none focus:border-red-400 font-mono"
                    />
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setImportPreview(null)}
                    disabled={importing}
                    className="px-4 py-2 border border-luxury-800 text-luxury-300 rounded-sm text-[10px] uppercase tracking-wider hover:border-gold-300 cursor-pointer disabled:opacity-40"
                  >
                    Clear
                  </button>
                  <button
                    onClick={runImport}
                    disabled={
                      importing || (importMode === "replace" && replaceConfirm !== "REPLACE")
                    }
                    className={`inline-flex items-center gap-2 px-5 py-2 rounded-sm text-[10px] uppercase tracking-widest font-bold cursor-pointer disabled:opacity-40 text-white ${
                      importMode === "replace"
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-gold-500 hover:bg-gold-600"
                    }`}
                  >
                    {importing ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Upload size={13} />
                    )}
                    {importing
                      ? "Importing"
                      : importMode === "replace"
                        ? "Replace all"
                        : "Append"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
