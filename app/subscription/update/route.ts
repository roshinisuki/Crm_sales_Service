import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, logAudit } from '@/lib/auth';

// PUT /subscription/update — Admin only
export async function PUT(req: NextRequest) {
  const session = await requireRole(req, ['Admin']);
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });

  try {
    const { id, planName, startDate, endDate, status, notes } = await req.json();

    if (!id) {
      return NextResponse.json({ success: false, message: 'Subscription ID is required' }, { status: 400 });
    }

    const subscription = await db.subscription.update({
      where: { id },
      data: {
        ...(planName  ? { planName }                  : {}),
        ...(startDate ? { startDate: new Date(startDate) } : {}),
        ...(endDate   ? { endDate:   new Date(endDate) }   : {}),
        ...(status    ? { status }                    : {}),
        ...(notes     ? { notes }                     : {}),
      },
    });

    await logAudit(session.userId, 'subscription', 'subscription_change', `Updated subscription ${id} status=${status}`);

    return NextResponse.json({ success: true, data: subscription });
  } catch (error) {
    console.error('[SubscriptionUpdate Error]', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
