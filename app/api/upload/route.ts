import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// POST /api/upload
export async function POST(request: NextRequest) {
  try {
    const user = await verifyAuth();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    if (user.role === "Customer") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ success: false, message: "Content type must be multipart/form-data" }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, message: "No file provided" }, { status: 400 });
    }

    // Save file to /public/uploads/documents/
    const uploadDir = path.join(process.cwd(), "public", "uploads", "documents");
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    const fileExt = path.extname(file.name);
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${fileExt}`;
    const filePath = path.join(uploadDir, fileName);
    const fileUrl = `/uploads/documents/${fileName}`;

    const arrayBuffer = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(arrayBuffer));

    return NextResponse.json({
      success: true,
      fileUrl,
      fileName: file.name,
      fileSize: file.size,
    });
  } catch (error: any) {
    console.error("POST /api/upload error:", error);
    return NextResponse.json({ success: false, message: error.message || "Upload failed" }, { status: 500 });
  }
}
