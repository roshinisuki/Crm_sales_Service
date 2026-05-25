import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, logAudit } from '@/lib/auth';

// POST /visit/create — MarketingExecutive, MarketingLead, Admin
export async function POST(req: NextRequest) {
  const session = await requireRole(req, ['Admin', 'MarketingLead', 'MarketingExecutive']);
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });

  try {
    const { customerId, remarks, nextMeetingDate } = await req.json();

    if (!customerId) {
      return NextResponse.json({ success: false, message: 'customerId is required' }, { status: 400 });
    }

    const visit = await db.marketingVisit.create({
      data: {
        executiveId: session.userId,
        customerId,
        remarks,
        nextMeetingDate: nextMeetingDate ? new Date(nextMeetingDate) : null,
        checkIn: new Date(),
      },
      include: { customer: { select: { name: true, customerCode: true } } },
    });

    await logAudit(session.userId, 'visit', 'create', `Visit created for customer ${customerId}`);

    return NextResponse.json({ success: true, data: visit }, { status: 201 });
  } catch (error) {
    console.error('[VisitCreate Error]', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
