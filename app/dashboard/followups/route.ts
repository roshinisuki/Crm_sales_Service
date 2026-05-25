import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';

// GET /dashboard/followups
export async function GET(req: NextRequest) {
  const session = await requireRole(req, ['Admin', 'MarketingLead', 'MarketingExecutive']);
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Admins and Leads see all; Executives only see their own
  const executiveFilter =
    session.role === 'MarketingExecutive' ? { executiveId: session.userId } : {};

  const [upcoming, overdue] = await Promise.all([
    db.marketingVisit.findMany({
      where: {
        ...executiveFilter,
        nextMeetingDate: { gte: today },
        checkOut: null, // Not yet done
      },
      include: {
        customer:   { select: { name: true, customerCode: true, phone: true } },
        executive:  { select: { name: true, email: true } },
      },
      orderBy: { nextMeetingDate: 'asc' },
    }),
    db.marketingVisit.findMany({
      where: {
        ...executiveFilter,
        nextMeetingDate: { lt: today },
        checkOut: null,
      },
      include: {
        customer:  { select: { name: true, customerCode: true, phone: true } },
        executive: { select: { name: true, email: true } },
      },
      orderBy: { nextMeetingDate: 'asc' },
    }),
  ]);

  return NextResponse.json({
    success: true,
    data: { upcoming, overdue },
  });
}
