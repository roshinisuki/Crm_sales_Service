import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

// GET /api/negotiations/[id]/notes
// Returns the discussion notes array for a negotiation.
import { enforceModuleGuard } from "@/lib/moduleGuard";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.NEGOTIATION, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/negotiations/[id]/notes");
  if (guard) return guard;

  const { id } = await params;

  const negotiation = await prisma.negotiation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    select: { discussionNotes: true },
  });

  if (!negotiation) return NextResponse.json({ success: false, message: "Negotiation not found" }, { status: 404 });

  let notes: any[] = [];
  if (negotiation.discussionNotes) {
    try {
      notes = JSON.parse(negotiation.discussionNotes);
    } catch {
      notes = [];
    }
  }

  return NextResponse.json({ success: true, data: notes });
}

// POST /api/negotiations/[id]/notes
// Appends a new discussion note to the negotiation's discussionNotes JSON array.
// Body: { note: string }

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  const guard = enforceModuleGuard(user, MODULE_KEYS.NEGOTIATION, "C:/Users/Sandhiya/Desktop/SUKI_CRM2/Crm_sales_Service//api/negotiations/[id]/notes");
  if (guard) return guard;
  if (user.role === "Customer") return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  if (!body.note || !body.note.trim()) {
    return NextResponse.json({ success: false, message: "Note text is required" }, { status: 400 });
  }

  const negotiation = await prisma.negotiation.findFirst({
    where: { id, deletedAt: null, companyId: user.companyId },
    select: { id: true, discussionNotes: true },
  });

  if (!negotiation) return NextResponse.json({ success: false, message: "Negotiation not found" }, { status: 404 });

  // Parse existing notes
  let notes: any[] = [];
  if (negotiation.discussionNotes) {
    try {
      notes = JSON.parse(negotiation.discussionNotes);
    } catch {
      notes = [];
    }
  }

  // Append new note
  const newNote = {
    id: `note-${Date.now()}`,
    text: body.note.trim(),
    createdById: user.id,
    createdByName: user.email,
    createdAt: new Date().toISOString(),
  };

  notes.push(newNote);

  await prisma.negotiation.update({
    where: { id },
    data: { discussionNotes: JSON.stringify(notes) },
  });

  return NextResponse.json({ success: true, data: notes, message: "Note added" }, { status: 201 });
}
