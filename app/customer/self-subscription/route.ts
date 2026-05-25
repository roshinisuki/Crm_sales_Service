import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateSession } from '@/lib/auth';

// GET /customer/self-subscription — Customer role only (their own subscription)
export async function GET(req: NextRequest) {
  const session = await validateSession(req);
  if (!session || session.role !== 'Customer') {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });
  }

  // Find customer linked by email
  const customer = await db.customer.findFirst({
    where: { email: session.email },
    include: {
      subscriptions: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!customer) {
    return NextResponse.json({ success: false, message: 'No customer record found for this account' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: customer });
}
