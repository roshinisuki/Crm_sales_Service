"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload, FileText, X, ChevronRight, ChevronLeft, Download,
  CheckCircle2, AlertTriangle, AlertCircle, Loader2, SkipForward,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { Modal } from "@/components/ui/Modal";

// ─── Constants ────────────────────────────────────────────────────────────────
const LEAD_FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: "name",            label: "Name",              required: true  },
  { key: "phone",           label: "Phone"                              },
  { key: "email",           label: "Email"                              },
  { key: "companyName",     label: "Company Name"                       },
  { key: "designation",     label: "Designation"                        },
  { key: "city",            label: "City"                               },
  { key: "industryType",    label: "Industry Type"                      },
  { key: "leadSource",      label: "Lead Source"                        },
  { key: "status",          label: "Status"                             },
  { key: "budgetAsked",     label: "Budget Asked"                       },
  { key: "estimatedValue",  label: "Estimated Value"                    },
  { key: "timelineAsked",   label: "Timeline Asked"                     },
  { key: "isGenuine",       label: "Is Genuine"                         },
  { key: "notes",           label: "Notes"                              },
  { key: "assignedToEmail", label: "Assign To (email)"                  },
];

const STEPS = ["Upload File", "Map Columns", "Preview & Validate", "Import"];
type Step = 0 | 1 | 2 | 3;

interface ParsedRow { [key: string]: string }
interface ImportResult {
  totalRows: number;
  imported: number;
  updated: number;
  duplicateInserted: number;
  skipped: number;
  failed: number;
  invalidRows: { rowIndex: number; errors: string[] }[];
  skippedRows: { rowIndex: number; reason: string }[];
  failedRows:  { rowIndex: number; reason: string }[];
}

// ─── CSV parser (browser side) ─────────────────────────────────────────────
function parseCSVText(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const cols: string[] = [];
    let cur = ""; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else { inQ = !inQ; } }
      else if (ch === "," && !inQ) { cols.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    cols.push(cur.trim());
    return cols;
  };

  const headers = parseLine(lines[0]);
  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const row: ParsedRow = {};
    headers.forEach((h, idx) => { row[h] = cols[idx] ?? ""; });
    rows.push(row);
  }
  return { headers, rows };
}

// ─── Excel parser via ExcelJS (only if xlsx) ──────────────────────────────
async function parseXlsxBuffer(buffer: ArrayBuffer): Promise<{ headers: string[]; rows: ParsedRow[] }> {
  // Dynamic import to avoid SSR issues
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };

  const firstRow = sheet.getRow(1);
  const rawHeaders = firstRow.values as any[];
  rawHeaders.shift(); // remove 0-index undefined
  const headers = rawHeaders.map(h => String(h ?? ""));

  const rows: ParsedRow[] = [];
  sheet.eachRow((row, rowNum) => {
    if (rowNum === 1) return;
    const obj: ParsedRow = {};
    headers.forEach((h, idx) => {
      const cell = row.getCell(idx + 1);
      obj[h] = cell.text ?? String(cell.value ?? "");
    });
    rows.push(obj);
  });
  return { headers, rows };
}

// ─── Auto-detect mapping ───────────────────────────────────────────────────
function autoDetectMapping(csvHeaders: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalize = (s: string) => s.toLowerCase().replace(/[\s_-]/g, "");
  const aliases: Record<string, string[]> = {
    name:            ["name","fullname","leadname","contactname"],
    phone:           ["phone","mobile","contact","mobileno","phoneno","cellphone"],
    email:           ["email","emailaddress","mail"],
    companyName:     ["companyname","company","organization","org"],
    designation:     ["designation","title","jobtitle","role","position"],
    city:            ["city","location","town"],
    industryType:    ["industrytype","industry","sector"],
    leadSource:      ["leadsource","source","how"],
    status:          ["status","leadstatus"],
    budgetAsked:     ["budgetasked","budget","budgetrange"],
    estimatedValue:  ["estimatedvalue","value","dealvalue","amount","estvalue"],
    timelineAsked:   ["timelineasked","timeline","expectedclose","closetimeline"],
    isGenuine:       ["isgenuine","genuine","verified"],
    notes:           ["notes","remarks","comments","message","description"],
    assignedToEmail: ["assignedtoemail","assignedemail","assignto","owner"],
  };

  for (const [field, aliasList] of Object.entries(aliases)) {
    for (const csvH of csvHeaders) {
      if (aliasList.includes(normalize(csvH))) {
        mapping[field] = csvH;
        break;
      }
    }
  }
  return mapping;
}

// ─── Row validator (client side preview) ──────────────────────────────────
const VALID_STATUSES = ["New","Contacted","FollowUpDue","SQL","Qualified","Lost"];
const VALID_SOURCES  = ["Website","Facebook","Instagram","LinkedIn","Referral","WalkIn","ColdCall","Partner","Trade Show","Tender Portal"];

function validateRowClient(mapped: Record<string, string>): string[] {
  const errs: string[] = [];
  if (!mapped.name?.trim())                    errs.push("Name is required");
  if (mapped.email?.trim()) {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(mapped.email.trim()))    errs.push("Invalid email format");
  }
  if (mapped.estimatedValue?.trim()) {
    if (isNaN(Number(mapped.estimatedValue)))  errs.push("Estimated Value must be a number");
  }
  const ig = mapped.isGenuine?.toLowerCase();
  if (ig && !["true","false","yes","no","1","0",""].includes(ig)) errs.push("isGenuine must be true/false/yes/no/1/0");
  if (mapped.status && !VALID_STATUSES.includes(mapped.status))   errs.push(`Invalid status: "${mapped.status}"`);
  if (mapped.leadSource && !VALID_SOURCES.includes(mapped.leadSource)) errs.push(`Invalid leadSource: "${mapped.leadSource}"`);
  return errs;
}

// ─── Main Modal ─────────────────────────────────────────────────────────────
interface Props { open: boolean; onClose: () => void; onImportDone?: () => void; }

export default function LeadImportModal({ open, onClose, onImportDone }: Props) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(0);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows,    setCsvRows]    = useState<ParsedRow[]>([]);
  const [parsing,   setParsing]    = useState(false);

  const [mapping, setMapping] = useState<Record<string, string>>({});

  const [duplicateAction, setDuplicateAction] = useState<"skip" | "update">("skip");
  const [importing,  setImporting]  = useState(false);
  const [result,     setResult]     = useState<ImportResult | null>(null);

  // ── Derived preview rows with validation ──────────────────────────────────
  const previewRows = csvRows.slice(0, 100).map((rawRow, idx) => {
    const mapped: Record<string, string> = {};
    for (const { key } of LEAD_FIELDS) {
      const col = mapping[key];
      if (col) mapped[key] = rawRow[col] ?? "";
    }
    const errors = validateRowClient(mapped);
    return { rowNum: idx + 2, mapped, errors };
  });
  const validCount   = previewRows.filter(r => r.errors.length === 0).length;
  const invalidCount = previewRows.filter(r => r.errors.length > 0).length;

  // ── File handling ─────────────────────────────────────────────────────────
  const handleFile = useCallback(async (f: File) => {
    const name = f.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".xlsx") && !name.endsWith(".xls")) {
      toast.error("Only .csv and .xlsx files are supported");
      return;
    }
    setFile(f);
    setParsing(true);
    try {
      let headers: string[] = [];
      let rows: ParsedRow[] = [];
      if (name.endsWith(".csv")) {
        const text = await f.text();
        ({ headers, rows } = parseCSVText(text));
      } else {
        const buf = await f.arrayBuffer();
        ({ headers, rows } = await parseXlsxBuffer(buf));
      }
      setCsvHeaders(headers);
      setCsvRows(rows);
      setMapping(autoDetectMapping(headers));
      setStep(1);
    } catch (e: any) {
      toast.error("Failed to parse file: " + e.message);
    } finally {
      setParsing(false);
    }
  }, [toast]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  // ── Import execution ──────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mapping", JSON.stringify(mapping));
      fd.append("duplicateAction", duplicateAction);

      const res = await fetch("/api/leads/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.success) { toast.error(data.message || "Import failed"); return; }
      setResult(data.data);
      setStep(3);
      onImportDone?.();
    } catch (e: any) {
      toast.error("Import error: " + e.message);
    } finally {
      setImporting(false);
    }
  };

  // ── Error CSV download ────────────────────────────────────────────────────
  const downloadErrorReport = () => {
    if (!result) return;
    const rows = [
      ["Row","Issue","Reason"],
      ...result.invalidRows.map(r => [r.rowIndex, "Validation", r.errors.join("; ")]),
      ...result.failedRows.map(r  => [r.rowIndex, "Import Failed", r.reason]),
      ...result.skippedRows.map(r => [r.rowIndex, "Skipped Duplicate", r.reason]),
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "lead-import-errors.csv";
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  // ── Template download ─────────────────────────────────────────────────────
  const downloadTemplate = () => { window.location.href = "/api/leads/import"; };

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = () => {
    setStep(0); setFile(null); setCsvHeaders([]); setCsvRows([]);
    setMapping({}); setResult(null); setImporting(false); setParsing(false);
  };
  const handleClose = () => { reset(); onClose(); };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Import Leads"
      subtitle="Upload a CSV or Excel file to bulk import leads"
      size="xl"
    >
      <div className="px-6 pb-6">

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6 mt-2">
          {STEPS.map((label, idx) => (
            <div key={idx} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                ${step === idx ? "bg-primary text-primary-foreground" : step > idx ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"}`}>
                {step > idx ? <CheckCircle2 size={14} /> : idx + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${step === idx ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
              {idx < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
            </div>
          ))}
        </div>

        {/* ── STEP 0: Upload ──────────────────────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer
                ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
            >
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              {parsing ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="animate-spin text-primary" size={40} />
                  <p className="text-sm text-muted-foreground">Parsing file…</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <Upload className="text-muted-foreground" size={28} />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Drag & drop or click to upload</p>
                    <p className="text-sm text-muted-foreground mt-1">Supported: .csv, .xlsx, .xls</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border border-border">
              <div>
                <p className="text-sm font-medium text-foreground">Need a template?</p>
                <p className="text-xs text-muted-foreground">Download the CSV template with correct column headers and example data</p>
              </div>
              <button onClick={downloadTemplate}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-background transition-colors">
                <Download size={15} /> Template
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 1: Column Mapping ──────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Map your file columns (<span className="font-medium text-foreground">{csvHeaders.length} columns</span>, <span className="font-medium text-foreground">{csvRows.length} rows</span>) to lead fields.
              </p>
            </div>
            <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1">
              {LEAD_FIELDS.map(({ key, label, required }) => (
                <div key={key} className="flex items-center gap-3 py-2 px-3 rounded-lg border border-border bg-background">
                  <div className="w-44 shrink-0">
                    <span className="text-sm font-medium text-foreground">{label}</span>
                    {required && <span className="text-red-500 ml-1 text-xs">*</span>}
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                  <select
                    className="flex-1 text-sm border border-input rounded-md px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    value={mapping[key] ?? ""}
                    onChange={e => setMapping(prev => ({ ...prev, [key]: e.target.value }))}
                  >
                    <option value="">-- skip / not mapped --</option>
                    {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  {mapping[key] && (
                    <span className="text-xs text-green-600 font-medium shrink-0">✓ mapped</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 2: Preview & Validate ─────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Summary bar */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-center dark:bg-blue-950 dark:border-blue-800">
                <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{csvRows.length}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">Total Rows</p>
              </div>
              <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-center dark:bg-green-950 dark:border-green-800">
                <p className="text-lg font-bold text-green-700 dark:text-green-300">{validCount}</p>
                <p className="text-xs text-green-600 dark:text-green-400">Valid</p>
              </div>
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-center dark:bg-red-950 dark:border-red-800">
                <p className="text-lg font-bold text-red-700 dark:text-red-300">{invalidCount}</p>
                <p className="text-xs text-red-600 dark:text-red-400">Invalid (will skip)</p>
              </div>
            </div>

            {/* Duplicate handling */}
            <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
                <AlertTriangle size={14} /> Duplicate Handling
              </p>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="dupAction" value="skip"
                    checked={duplicateAction === "skip"}
                    onChange={() => setDuplicateAction("skip")} />
                  <span>Skip duplicates (safe)</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="dupAction" value="update"
                    checked={duplicateAction === "update"}
                    onChange={() => setDuplicateAction("update")} />
                  <span>Overwrite/update duplicates</span>
                </label>
              </div>
            </div>

            {/* Row preview table */}
            <div className="max-h-[280px] overflow-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left w-12">#</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="px-3 py-2 text-left">Phone</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left w-48">Validation</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map(({ rowNum, mapped, errors }) => (
                    <tr key={rowNum} className={errors.length > 0 ? "bg-red-50 dark:bg-red-950" : ""}>
                      <td className="px-3 py-1.5 text-muted-foreground">{rowNum}</td>
                      <td className="px-3 py-1.5 font-medium truncate max-w-[120px]">{mapped.name || <span className="text-red-500">—</span>}</td>
                      <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[140px]">{mapped.email || "—"}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{mapped.phone || "—"}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{mapped.status || "New"}</td>
                      <td className="px-3 py-1.5">
                        {errors.length === 0
                          ? <span className="text-green-600 flex items-center gap-1"><CheckCircle2 size={12} /> Valid</span>
                          : <span className="text-red-600 flex items-start gap-1"><AlertCircle size={12} className="shrink-0 mt-0.5" /><span>{errors[0]}{errors.length > 1 ? ` +${errors.length - 1}` : ""}</span></span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {csvRows.length > 100 && (
              <p className="text-xs text-muted-foreground text-center">Showing first 100 rows — all {csvRows.length} rows will be imported.</p>
            )}
          </div>
        )}

        {/* ── STEP 3: Result ─────────────────────────────────────────────── */}
        {step === 3 && result && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Total Rows", value: result.totalRows, color: "blue" },
                { label: "Imported",   value: result.imported,  color: "green" },
                { label: "Duplicates", value: result.duplicateInserted ?? result.skipped, color: "amber" },
                { label: "Failed",     value: result.failed,    color: "red" },
              ].map(({ label, value, color }) => (
                <div key={label} className={`p-3 rounded-lg text-center bg-${color}-50 border border-${color}-200 dark:bg-${color}-950 dark:border-${color}-800`}>
                  <p className={`text-2xl font-bold text-${color}-700 dark:text-${color}-300`}>{value}</p>
                  <p className={`text-xs text-${color}-600 dark:text-${color}-400`}>{label}</p>
                </div>
              ))}
            </div>
            {result.updated > 0 && (
              <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 dark:bg-purple-950 dark:border-purple-800 text-center">
                <p className="text-purple-700 dark:text-purple-300 font-semibold">{result.updated} existing leads updated</p>
              </div>
            )}
            {(result.duplicateInserted ?? 0) > 0 && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950 dark:border-amber-800 flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  <span className="font-semibold">{result.duplicateInserted} existing leads</span> were flagged as <strong>Duplicate</strong> — review them in the <strong>Duplicate Leads</strong> tab.
                </p>
              </div>
            )}
            {result.imported > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200 dark:bg-green-950 dark:border-green-800">
                <CheckCircle2 className="text-green-600 shrink-0" size={20} />
                <p className="text-sm text-green-700 dark:text-green-300 font-medium">{result.imported} leads imported successfully!</p>
              </div>
            )}
            {result.failed > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-red-600 flex items-center gap-2"><AlertTriangle size={14} /> {result.failed} rows failed</p>
                  <button onClick={downloadErrorReport}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
                    <Download size={13} /> Error Report
                  </button>
                </div>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800 p-2 space-y-1">
                  {[...result.invalidRows, ...result.failedRows].slice(0, 20).map((r, i) => (
                    <p key={i} className="text-xs text-red-700 dark:text-red-300">
                      Row {r.rowIndex}: {"errors" in r ? (r as any).errors.join("; ") : (r as any).reason}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Navigation ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            {step > 0 && step < 3 && (
              <button onClick={() => setStep(s => (s - 1) as Step)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
                <ChevronLeft size={15} /> Back
              </button>
            )}
            {step === 3 && (
              <button onClick={reset}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
                Import Another File
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={handleClose}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
              {step === 3 ? "Close" : "Cancel"}
            </button>

            {step === 1 && (
              <button
                onClick={() => setStep(2)}
                disabled={!mapping["name"]}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
                Preview <ChevronRight size={15} />
              </button>
            )}

            {step === 2 && (
              <button
                onClick={handleImport}
                disabled={importing || validCount === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
                {importing ? <><Loader2 size={15} className="animate-spin" /> Importing…</> : `Import ${validCount} Lead${validCount !== 1 ? "s" : ""}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
