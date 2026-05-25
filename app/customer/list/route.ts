import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/auth';

// GET /customer/list — Admin, MarketingLead
export async function GET(req: NextRequest) {
  const session = await requireRole(req, ['Admin', 'MarketingLead']);
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const name   = searchParams.get('name') || undefined;
  const code   = searchParams.get('code') || undefined;
  const city   = searchParams.get('city') || undefined;
  const status = searchParams.get('status') || undefined;

  const customers = await db.customer.findMany({
    where: {
      ...(name   ? { name:         { contains: name } }   : {}),
      ...(code   ? { customerCode: { contains: code } }   : {}),
      ...(city   ? { city:         { contains: city } }   : {}),
      ...(status ? { status: status as any }               : {}),
    },
    include: { subscriptions: { select: { planName: true, status: true, endDate: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ success: true, data: customers });
}
