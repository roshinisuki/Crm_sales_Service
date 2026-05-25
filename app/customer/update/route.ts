import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, logAudit } from '@/lib/auth';

// PUT /customer/update — Admin only
export async function PUT(req: NextRequest) {
  const session = await requireRole(req, ['Admin']);
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });

  try {
    const { id, name, email, phone, city, status } = await req.json();

    if (!id) {
      return NextResponse.json({ success: false, message: 'Customer ID is required' }, { status: 400 });
    }

    const customer = await db.customer.update({
      where: { id },
      data: {
        ...(name   ? { name }   : {}),
        ...(email  ? { email }  : {}),
        ...(phone  ? { phone }  : {}),
        ...(city   ? { city }   : {}),
        ...(status ? { status } : {}),
      },
    });

    await logAudit(session.userId, 'customer', 'update', `Updated customer ${id}`);

    return NextResponse.json({ success: true, data: customer });
  } catch (error) {
    console.error('[CustomerUpdate Error]', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
