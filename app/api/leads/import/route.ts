import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { z } from "zod";
import * as ExcelJS from "exceljs";

// ─── Zod schema for a single importable lead row ──────────────────────────────
const VALID_STATUSES = ["New", "Contacted", "FollowUpDue", "SQL", "Qualified", "Lost"] as const;
const VALID_SOURCES  = ["Website","Facebook","Instagram","LinkedIn","Referral","WalkIn","ColdCall","Partner","Trade Show","Tender Portal"] as const;

const LeadImportRowSchema = z.object({
  name:            z.string().min(1, "Name is required"),
  phone:           z.string().optional().nullable(),
  email:           z.string().email("Invalid email format").optional().nullable().or(z.literal("")).transform(v => v || null),
  companyName:     z.string().optional().nullable(),
  designation:     z.string().optional().nullable(),
  city:            z.string().optional().nullable(),
  industryType:    z.string().optional().nullable(),
  leadSource:      z.string().optional().nullable(),
  status:          z.string().optional().nullable(),
  budgetAsked:     z.string().optional().nullable(),
  estimatedValue:  z.preprocess(v => (v === "" || v == null ? null : Number(v)), z.number().nullable().optional()),
  timelineAsked:   z.string().optional().nullable(),
  isGenuine: z.preprocess(
    v => { const s = String(v ?? "").toLowerCase(); return ["true","yes","1"].includes(s) ? true : ["false","no","0",""].includes(s) ? false : v; },
    z.boolean().optional()
  ),
  notes:           z.string().optional().nullable(),
  assignedToEmail: z.string().optional().nullable(),
});

type ImportRow = z.infer<typeof LeadImportRowSchema>;

// ─── Lead code generator ──────────────────────────────────────────────────────
async function generateLeadCode(companyId: string | null | undefined, offset: number): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `LD-${year}-`;
  const count = await prisma.lead.count({
    where: { leadCode: { startsWith: prefix }, ...(companyId ? { companyId } : {}) },
  });
  const seq = String(count + 1 + offset).padStart(5, "0");
  return `${prefix}${seq}`;
}

// ─── Parse CSV manually (no extra libs needed — exceljs handles xlsx) ─────────
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  for (const line of lines) {
    const cols: string[] = [];
    let current = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuote = !inQuote; }
      } else if (ch === "," && !inQuote) {
        cols.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    cols.push(current.trim());
    rows.push(cols);
  }
  return rows;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    if (!["Admin", "SalesManager"].includes(user.role)) {
      return NextResponse.json({ success: false, message: "Forbidden: Only Admin or Sales Manager can import leads" }, { status: 403 });
    }

    const companyId = user.companyId ?? null;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const mappingRaw = formData.get("mapping") as string | null;
    const duplicateAction = (formData.get("duplicateAction") as string) || "skip"; // "skip" | "update"

    if (!file) return NextResponse.json({ success: false, message: "No file uploaded" }, { status: 400 });
    if (!mappingRaw) return NextResponse.json({ success: false, message: "Column mapping is required" }, { status: 400 });

    let mapping: Record<string, string> = {};
    try { mapping = JSON.parse(mappingRaw); } catch { return NextResponse.json({ success: false, message: "Invalid mapping JSON" }, { status: 400 }); }

    const fileName = file.name.toLowerCase();
    const isXlsx = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
    const isCsv  = fileName.endsWith(".csv");
    if (!isXlsx && !isCsv) return NextResponse.json({ success: false, message: "Unsupported file type. Only CSV and XLSX allowed." }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());

    // ── Parse file into raw rows ──────────────────────────────────────────────
    let headers: string[] = [];
    let rawRows: Record<string, string>[] = [];

    if (isCsv) {
      const text = buffer.toString("utf-8");
      const parsed = parseCSV(text);
      if (parsed.length < 1) return NextResponse.json({ success: false, message: "Empty CSV file" }, { status: 400 });
      headers = parsed[0];
      for (let i = 1; i < parsed.length; i++) {
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => { row[h] = parsed[i][idx] ?? ""; });
        rawRows.push(row);
      }
    } else {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
      const sheet = workbook.worksheets[0];
      if (!sheet) return NextResponse.json({ success: false, message: "Empty Excel file" }, { status: 400 });
      const firstRow = sheet.getRow(1);
      headers = firstRow.values as string[];
      headers.shift(); // ExcelJS rows are 1-indexed; index 0 is undefined

      sheet.eachRow((row, rowNum) => {
        if (rowNum === 1) return;
        const obj: Record<string, string> = {};
        headers.forEach((h, idx) => {
          const cell = row.getCell(idx + 1);
          obj[h] = cell.text ?? String(cell.value ?? "");
        });
        rawRows.push(obj);
      });
    }

    // ── Apply mapping: {leadField: csvColumn} → normalize each row ───────────
    const LEAD_FIELDS = [
      "name","phone","email","companyName","designation","city","industryType",
      "leadSource","status","budgetAsked","estimatedValue","timelineAsked",
      "isGenuine","notes","assignedToEmail",
    ];

    const normalized: Record<string, any>[] = rawRows.map(rawRow => {
      const row: Record<string, any> = {};
      for (const leadField of LEAD_FIELDS) {
        const csvCol = mapping[leadField];
        if (csvCol && rawRow[csvCol] !== undefined) {
          row[leadField] = rawRow[csvCol];
        }
      }
      return row;
    });

    // ── Validate each row ─────────────────────────────────────────────────────
    type ValidRow = ImportRow & { _rowIndex: number };
    const validRows:   ValidRow[] = [];
    const invalidRows: { rowIndex: number; errors: string[] }[] = [];

    normalized.forEach((row, idx) => {
      const result = LeadImportRowSchema.safeParse(row);
      if (result.success) {
        // Validate status / source against allowed lists
        const errors: string[] = [];
        const s = result.data.status;
        const src = result.data.leadSource;
        if (s && !VALID_STATUSES.includes(s as any)) errors.push(`Invalid status: "${s}"`);
        if (src && !VALID_SOURCES.includes(src as any)) errors.push(`Invalid leadSource: "${src}"`);
        if (errors.length > 0) {
          invalidRows.push({ rowIndex: idx + 2, errors });
        } else {
          validRows.push({ ...result.data, _rowIndex: idx + 2 });
        }
      } else {
        invalidRows.push({
          rowIndex: idx + 2,
          errors: result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`),
        });
      }
    });

    // ── Duplicate detection ───────────────────────────────────────────────────
    const dupEmails = validRows
      .filter(r => r.email)
      .map(r => r.email as string);
    const dupPhones = validRows
      .filter(r => r.phone)
      .map(r => r.phone as string);

    const [existingByEmail, existingByPhone] = await Promise.all([
      dupEmails.length > 0
        ? prisma.lead.findMany({ where: { email: { in: dupEmails }, ...(companyId ? { companyId } : {}), deletedAt: null }, select: { id: true, email: true, phone: true, leadCode: true } })
        : [],
      dupPhones.length > 0
        ? prisma.lead.findMany({ where: { phone: { in: dupPhones }, ...(companyId ? { companyId } : {}), deletedAt: null }, select: { id: true, email: true, phone: true, leadCode: true } })
        : [],
    ]);

    const emailDupMap = new Map(existingByEmail.map(l => [l.email!, l]));
    const phoneDupMap = new Map(existingByPhone.map(l => [l.phone!, l]));

    const toImport:    ValidRow[] = [];
    const toUpdate:    { row: ValidRow; existing: { id: string; leadCode: string } }[] = [];
    const toMarkDup:   { existingId: string; existingCode: string }[] = [];

    for (const row of validRows) {
      const dupByEmail = row.email ? emailDupMap.get(row.email) : null;
      const dupByPhone = row.phone ? phoneDupMap.get(row.phone) : null;
      const dup = dupByEmail || dupByPhone;

      if (dup) {
        if (duplicateAction === "update") {
          toUpdate.push({ row, existing: dup });
        } else {
          // Mark the existing lead as Duplicate so it appears in the Duplicate tab
          toMarkDup.push({ existingId: dup.id, existingCode: dup.leadCode });
        }
      } else {
        toImport.push(row);
      }
    }

    // ── Resolve assignedToEmail → userId ──────────────────────────────────────
    const assignEmails = [...new Set([
      ...toImport,
      ...toUpdate.map(u => u.row),
    ].map(r => r.assignedToEmail).filter(Boolean))] as string[];

    const assignUsers = assignEmails.length > 0
      ? await prisma.user.findMany({ where: { email: { in: assignEmails }, ...(companyId ? { companyId } : {}), isActive: true }, select: { id: true, email: true } })
      : [];
    const assignMap = new Map(assignUsers.map(u => [u.email, u.id]));

    // ── Insert new leads ──────────────────────────────────────────────────────
    let imported = 0;
    let updated  = 0;
    const failedRows: { rowIndex: number; reason: string }[] = [];

    const BATCH = 50;
    for (let i = 0; i < toImport.length; i += BATCH) {
      const batch = toImport.slice(i, i + BATCH);
      for (const row of batch) {
        try {
          const leadCode  = await generateLeadCode(companyId, imported);
          const assignId  = row.assignedToEmail ? (assignMap.get(row.assignedToEmail) ?? null) : null;
          const status    = (row.status as any) || "New";
          const now       = new Date();
          const slaDeadline = new Date(now.getTime() + 15 * 60 * 1000);

          const lead = await prisma.lead.create({
            data: {
              leadCode,
              name:            row.name.trim(),
              phone:           row.phone?.trim() || null,
              email:           row.email?.trim() || null,
              companyName:     row.companyName?.trim() || null,
              designation:     row.designation?.trim() || null,
              city:            row.city?.trim() || null,
              industryType:    row.industryType?.trim() || null,
              leadSource:      (row.leadSource as any) || "Website",
              status:          status,
              budgetAsked:     row.budgetAsked?.trim() || null,
              estimatedValue:  row.estimatedValue ?? null,
              timelineAsked:   row.timelineAsked?.trim() || null,
              isGenuine:       row.isGenuine ?? false,
              notes:           row.notes?.trim() || null,
              assignedUserId:  assignId,
              companyId:       companyId,
              slaStatus:       "Pending",
              slaResponseDeadline: slaDeadline,
              escalationLevel: 0,
              leadScore:       0,
              lastInteractionAt: now,
            },
          });

          // Write status history
          await prisma.leadStatusHistory.create({
            data: { leadId: lead.id, fromStatus: null, toStatus: status, changedById: user.id, notes: "Imported via CSV/Excel" },
          }).catch(() => {});

          imported++;
        } catch (err: any) {
          failedRows.push({ rowIndex: row._rowIndex, reason: err.message || "Database error" });
        }
      }
    }

    // ── Update duplicates (if chosen) ────────────────────────────────────────
    for (const { row, existing } of toUpdate) {
      try {
        const assignId = row.assignedToEmail ? (assignMap.get(row.assignedToEmail) ?? null) : null;
        await prisma.lead.update({
          where: { id: existing.id },
          data: {
            name:            row.name.trim(),
            phone:           row.phone?.trim() || undefined,
            companyName:     row.companyName?.trim() || undefined,
            designation:     row.designation?.trim() || undefined,
            city:            row.city?.trim() || undefined,
            industryType:    row.industryType?.trim() || undefined,
            leadSource:      (row.leadSource as any) || undefined,
            budgetAsked:     row.budgetAsked?.trim() || undefined,
            estimatedValue:  row.estimatedValue ?? undefined,
            timelineAsked:   row.timelineAsked?.trim() || undefined,
            isGenuine:       row.isGenuine ?? undefined,
            notes:           row.notes?.trim() || undefined,
            assignedUserId:  assignId || undefined,
          },
        });
        updated++;
      } catch (err: any) {
        failedRows.push({ rowIndex: row._rowIndex, reason: err.message || "Database error" });
      }
    }

    // ── Mark existing leads as Duplicate so they appear in Duplicate tab ────────
    // (Safer than inserting new records — avoids email @unique constraint issues)
    let duplicateInserted = 0;
    for (const { existingId, existingCode } of toMarkDup) {
      try {
        const existing = await prisma.lead.findUnique({ where: { id: existingId }, select: { status: true } });
        if (!existing) continue;

        // Only mark as Duplicate if not already in a terminal/duplicate state
        if (existing.status !== "Duplicate") {
          await prisma.lead.update({
            where: { id: existingId },
            data: {
              status:       "Duplicate",
              isDuplicateOf: existingId, // self-reference flag: flagged via import
            },
          });

          await prisma.leadStatusHistory.create({
            data: {
              leadId:      existingId,
              fromStatus:  existing.status,
              toStatus:    "Duplicate",
              changedById: user.id,
              notes:       "Flagged as duplicate via CSV/Excel import",
            },
          }).catch(() => {});
        }

        duplicateInserted++;
      } catch (err: any) {
        failedRows.push({ rowIndex: 0, reason: `Could not flag ${existingCode} as duplicate: ${err.message}` });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        totalRows:        rawRows.length,
        imported,
        updated,
        duplicateInserted,
        skipped:          0,
        failed:           invalidRows.length + failedRows.length,
        invalidRows,
        skippedRows:      [],
        failedRows,
      },
    });
  } catch (error: any) {
    console.error("POST /api/leads/import error:", error);
    return NextResponse.json({ success: false, message: error.message || "Internal server error" }, { status: 500 });
  }
}

// ─── GET: return CSV template ─────────────────────────────────────────────────
export async function GET() {
  const headers = "name,phone,email,companyName,designation,city,industryType,leadSource,status,budgetAsked,estimatedValue,timelineAsked,isGenuine,notes";
  const example = "Ravi Kumar,9876543210,ravi.kumar@example.com,Apex Industries,Purchase Manager,Mumbai,Automotive,Referral,New,5-10 Lakhs,750000,Q3 2025,yes,Interested in industrial pumps";
  const csv = `${headers}\n${example}\n`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="lead-import-template.csv"',
    },
  });
}
