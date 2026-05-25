import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, logAudit } from '@/lib/auth';

// POST /visit/checkout — set checkOut timestamp for own visit
export async function POST(req: NextRequest) {
  const session = await requireRole(req, ['Admin', 'MarketingLead', 'MarketingExecutive']);
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });

  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ success: false, message: 'Visit ID is required' }, { status: 400 });
    }

    const visit = await db.marketingVisit.findUnique({ where: { id } });
    if (!visit) return NextResponse.json({ success: false, message: 'Visit not found' }, { status: 404 });

    if (session.role !== 'Admin' && visit.executiveId !== session.userId) {
      return NextResponse.json({ success: false, message: 'Forbidden — not your visit' }, { status: 403 });
    }

    if (visit.checkOut) {
      return NextResponse.json({ success: false, message: 'Already checked out' }, { status: 409 });
    }

    const updated = await db.marketingVisit.update({
      where: { id },
      data: { checkOut: new Date() },
    });

    await logAudit(session.userId, 'visit', 'update', `Checkout recorded for visit ${id}`);

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[VisitCheckout Error]', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
