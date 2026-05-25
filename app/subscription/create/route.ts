import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, logAudit } from '@/lib/auth';

// POST /subscription/create — Admin only
export async function POST(req: NextRequest) {
  const session = await requireRole(req, ['Admin']);
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });

  try {
    const { customerId, planName, startDate, endDate, status, notes } = await req.json();

    if (!customerId || !planName || !startDate || !endDate) {
      return NextResponse.json({ success: false, message: 'customerId, planName, startDate, endDate are required' }, { status: 400 });
    }

    const subscription = await db.subscription.create({
      data: {
        customerId,
        planName,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: status ?? 'Active',
        notes,
      },
    });

    await logAudit(session.userId, 'subscription', 'create', `Created subscription for customer ${customerId}`);

    return NextResponse.json({ success: true, data: subscription }, { status: 201 });
  } catch (error) {
    console.error('[SubscriptionCreate Error]', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
