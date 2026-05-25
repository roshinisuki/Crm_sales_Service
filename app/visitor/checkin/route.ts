import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, logAudit } from '@/lib/auth';

// POST /visitor/checkin
export async function POST(req: NextRequest) {
  const session = await requireRole(req, ['Admin', 'MarketingLead', 'MarketingExecutive']);
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });

  try {
    const { visitorName, visitorEmail, visitorPhone, purpose, hostUserId } = await req.json();

    if (!visitorName || !visitorPhone || !purpose || !hostUserId) {
      return NextResponse.json({ success: false, message: 'visitorName, visitorPhone, purpose, hostUserId are required' }, { status: 400 });
    }

    const visitor = await db.visitor.create({
      data: {
        visitorName,
        visitorEmail,
        visitorPhone,
        purpose,
        hostUserId,
        inTime: new Date(),
      },
    });

    await logAudit(session.userId, 'visitor', 'create', `Visitor ${visitorName} checked in`);

    return NextResponse.json({ success: true, data: visitor }, { status: 201 });
  } catch (error) {
    console.error('[VisitorCheckin Error]', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
