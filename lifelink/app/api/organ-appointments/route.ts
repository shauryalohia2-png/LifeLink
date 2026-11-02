import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { fullName?: string; contact?: string; email?: string; topic?: string; institution?: string; requestedAt?: string; notes?: string };
    const fullName = body.fullName?.trim(), contact = body.contact?.trim(), topic = body.topic?.trim(), requestedAt = new Date(body.requestedAt || '');
    if (!fullName || !contact || !topic || !body.requestedAt || Number.isNaN(requestedAt.getTime()) || requestedAt <= new Date()) return NextResponse.json({ error: 'Enter your name, contact, reason and a future preferred date/time.' }, { status: 400 });
    if (fullName.length > 100 || contact.length > 40 || topic.length > 80 || (body.notes?.length || 0) > 1000) return NextResponse.json({ error: 'Please shorten one or more fields.' }, { status: 400 });
    const user = await getSessionUser();
    const referenceCode = `ORG-${randomBytes(4).toString('hex').toUpperCase()}`;
    const item = await prisma.organAppointment.create({ data: { referenceCode, userId: user?.id, fullName, contact, email: body.email?.trim() || null, topic, preferredInstitution: body.institution?.trim() || null, requestedAt, notes: body.notes?.trim() || null } });
    return NextResponse.json({ success: true, referenceCode: item.referenceCode, status: 'PENDING_REVIEW', message: 'Your request is saved. This is an appointment enquiry, not a confirmed hospital appointment.' }, { status: 201 });
  } catch (error) {
    console.error('organ appointment error', error);
    return NextResponse.json({ error: 'Could not save your request. Check database configuration and try again.' }, { status: 500 });
  }
}
