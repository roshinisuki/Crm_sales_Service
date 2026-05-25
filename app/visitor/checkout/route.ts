import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, logAudit } from '@/lib/auth';

// POST /visitor/checkout
export async function POST(req: NextRequest) {
  const session = await requireRole(req, ['Admin', 'MarketingLead', 'MarketingExecutive']);
  if (!session) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 });

  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ success: false, message: 'Visitor ID is required' }, { status: 400 });
    }

    const visitor = await db.visitor.findUnique({ where: { id } });
    if (!visitor) return NextResponse.json({ success: false, message: 'Visitor not found' }, { status: 404 });

    if (visitor.outTime) {
      return NextResponse.json({ success: false, message: 'Visitor already checked out' }, { status: 409 });
    }

    const updated = await db.visitor.update({
      where: { id },
      data: { outTime: new Date() },
    });

    await logAudit(session.userId, 'visitor', 'update', `Visitor ${visitor.visitorName} checked out`);

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[VisitorCheckout Error]', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
