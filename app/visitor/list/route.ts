import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';

// GET /visitor/list — Admin, MarketingLead
export async function GET(req: NextRequest) {
  const session = await requireRole(req, ['Admin', 'MarketingLead']);
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const visitorName = searchParams.get('visitorName') || undefined;
  const hostUserId  = searchParams.get('hostUserId')  || undefined;
  const from        = searchParams.get('from')        || undefined;
  const to          = searchParams.get('to')          || undefined;

  const visitors = await db.visitor.findMany({
    where: {
      ...(visitorName ? { visitorName: { contains: visitorName } } : {}),
      ...(hostUserId  ? { hostUserId }                              : {}),
      ...(from || to  ? {
        inTime: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to   ? { lte: new Date(to) }   : {}),
        },
      } : {}),
    },
    include: { host: { select: { name: true, email: true } } },
    orderBy: { inTime: 'desc' },
  });

  return NextResponse.json({ success: true, data: visitors });
}
