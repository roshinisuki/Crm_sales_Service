import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, logAudit } from '@/lib/auth';

// PUT /visit/update-remarks — own visits only
export async function PUT(req: NextRequest) {
  const session = await requireRole(req, ['Admin', 'MarketingLead', 'MarketingExecutive']);
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });

  try {
    const { id, remarks, nextMeetingDate } = await req.json();

    if (!id) {
      return NextResponse.json({ success: false, message: 'Visit ID is required' }, { status: 400 });
    }

    const visit = await db.marketingVisit.findUnique({ where: { id } });
    if (!visit) return NextResponse.json({ success: false, message: 'Visit not found' }, { status: 404 });

    // Non-admins can only update their own visits
    if (session.role !== 'Admin' && visit.executiveId !== session.userId) {
      return NextResponse.json({ success: false, message: 'Forbidden — not your visit' }, { status: 403 });
    }

    const updated = await db.marketingVisit.update({
      where: { id },
      data: {
        ...(remarks         ? { remarks }                              : {}),
        ...(nextMeetingDate ? { nextMeetingDate: new Date(nextMeetingDate) } : {}),
      },
    });

    await logAudit(session.userId, 'visit', 'update', `Updated remarks for visit ${id}`);

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[VisitUpdateRemarks Error]', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
