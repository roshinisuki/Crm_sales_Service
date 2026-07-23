import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import path from "path";
import * as fs from "fs/promises";
import { PDFParse } from "pdf-parse";
import ExcelJS from "exceljs";

import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth();
    if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.RFQ, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/rfq/parse-template");
  if (guard) return guard;
    if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ success: false, message: "No file uploaded" }, { status: 400 });

    const ext = path.extname(file.name).toLowerCase();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let parsedLineItems: any[] = [];
    let rawText = "";

    if (ext === ".pdf") {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      rawText = result.text;
      parsedLineItems = parsePdfLineItems(rawText);
    } else if (ext === ".xlsx" || ext === ".xls") {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer as any);
      parsedLineItems = parseExcelLineItems(workbook);
    } else if (ext === ".csv") {
      const text = buffer.toString("utf-8");
      parsedLineItems = parseCsvLineItems(text);
    } else {
      return NextResponse.json({ success: false, message: "Unsupported file format" }, { status: 400 });
    }

    // Save the uploaded file to public/uploads/rfq-templates/
    const uploadDir = path.join(process.cwd(), "public", "uploads", "rfq-templates");
    await fs.mkdir(uploadDir, { recursive: true });
    
    // Create unique filename
    const uniqueFilename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const filePath = path.join(uploadDir, uniqueFilename);
    await fs.writeFile(filePath, buffer);
    const fileUrl = `/uploads/rfq-templates/${uniqueFilename}`;

    return NextResponse.json({
      success: true,
      data: {
        lineItems: parsedLineItems,
        templateFileName: file.name,
        templateFileUrl: fileUrl,
        rawText: ext === ".pdf" ? rawText : undefined,
      },
    });
  } catch (error: any) {
    console.error("Template parse error:", error);
    return NextResponse.json({ success: false, message: `Failed to parse template: ${error.message}` }, { status: 500 });
  }
}

// Basic Parsing Strategies (stubbed logic from the implementation plan)

function parsePdfLineItems(text: string) {
  const items: any[] = [];
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  
  // Basic regex looking for: [Index or start] [Description] [Qty]
  const pattern = /(?:\d+\.?\s+)?(.+?)\s+(\d+(?:\.\d+)?)\s*(?:pcs|nos|kg|set|units?)?\s*(?:₹?\s*\d+(?:\.\d+)?)?$/i;
  
  for (const line of lines) {
    // Skip likely headers or short lines
    if (line.length < 5 || line.toLowerCase().includes("description")) continue;
    
    const match = line.match(pattern);
    if (match) {
      const desc = match[1].trim();
      if (desc && desc.length > 3) {
        items.push({
          item_description: desc,
          quantity: match[2],
          unit: "Pcs", // Defaulting to Pcs
          target_price: "",
          specifications: ""
        });
      }
    }
  }
  
  // If parsing failed to find structure, we could return a chunk
  if (items.length === 0) {
    items.push({
      item_description: "Could not auto-parse items. Please edit manually.",
      quantity: "1",
      unit: "Pcs",
      target_price: "",
      specifications: text.substring(0, 500)
    });
  }
  
  return items;
}

function parseExcelLineItems(workbook: ExcelJS.Workbook) {
  const items: any[] = [];
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return items;

  let headerRow = 1;
  let descCol = -1, qtyCol = -1, unitCol = -1, priceCol = -1, specCol = -1;

  // Find header row (scanning first 10 rows)
  for (let r = 1; r <= Math.min(worksheet.rowCount, 10); r++) {
    const row = worksheet.getRow(r);
    let foundHeader = false;
    row.eachCell((cell, colNumber) => {
      const val = cell.text.toLowerCase();
      if (val.includes("description") || val.includes("item") || val.includes("product")) {
        descCol = colNumber; foundHeader = true;
      }
      if (val.includes("qty") || val.includes("quantity")) qtyCol = colNumber;
      if (val.includes("unit")) unitCol = colNumber;
      if (val.includes("price") || val.includes("rate")) priceCol = colNumber;
      if (val.includes("spec")) specCol = colNumber;
    });
    if (foundHeader) {
      headerRow = r;
      break;
    }
  }

  // Extract data rows
  if (descCol > -1) {
    for (let r = headerRow + 1; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      const desc = row.getCell(descCol).text.trim();
      if (!desc) continue; // Skip empty rows

      items.push({
        item_description: desc,
        quantity: qtyCol > -1 ? (row.getCell(qtyCol).value?.toString() || "1") : "1",
        unit: unitCol > -1 ? (row.getCell(unitCol).text || "") : "Pcs",
        target_price: priceCol > -1 ? (row.getCell(priceCol).value?.toString() || "") : "",
        specifications: specCol > -1 ? (row.getCell(specCol).text || "") : "",
      });
    }
  }

  return items;
}

function parseCsvLineItems(text: string) {
  const items: any[] = [];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length < 2) return items;

  const headers = lines[0].toLowerCase().split(",");
  let descIdx = headers.findIndex(h => h.includes("description") || h.includes("item") || h.includes("product"));
  let qtyIdx = headers.findIndex(h => h.includes("qty") || h.includes("quantity"));
  let unitIdx = headers.findIndex(h => h.includes("unit"));
  let priceIdx = headers.findIndex(h => h.includes("price") || h.includes("rate"));
  let specIdx = headers.findIndex(h => h.includes("spec"));

  if (descIdx === -1) descIdx = 0; // Default to first column if no header found

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim().replace(/^"|"$/g, ""));
    if (!cols[descIdx]) continue;

    items.push({
      item_description: cols[descIdx],
      quantity: qtyIdx > -1 && cols[qtyIdx] ? cols[qtyIdx] : "1",
      unit: unitIdx > -1 && cols[unitIdx] ? cols[unitIdx] : "Pcs",
      target_price: priceIdx > -1 && cols[priceIdx] ? cols[priceIdx] : "",
      specifications: specIdx > -1 && cols[specIdx] ? cols[specIdx] : "",
    });
  }

  return items;
}
