import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, logAudit } from '@/lib/auth';

// POST /customer/create — Admin only
export async function POST(req: NextRequest) {
  const session = await requireRole(req, ['Admin']);
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });

  try {
    const { customerCode, name, email, phone, city, status } = await req.json();

    if (!customerCode || !name) {
      return NextResponse.json({ success: false, message: 'customerCode and name are required' }, { status: 400 });
    }

    const existing = await db.customer.findUnique({ where: { customerCode } });
    if (existing) {
      return NextResponse.json({ success: false, message: 'Customer code already exists' }, { status: 409 });
    }

    const customer = await db.customer.create({
      data: { customerCode, name, email, phone, city, status: status ?? 'Active' },
    });

    await logAudit(session.userId, 'customer', 'create', `Created customer ${customerCode}`);

    return NextResponse.json({ success: true, data: customer }, { status: 201 });
  } catch (error) {
    console.error('[CustomerCreate Error]', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
