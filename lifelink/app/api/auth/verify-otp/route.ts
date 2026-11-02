import { NextRequest, NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { setSession } from '@/lib/auth';

export const runtime = 'nodejs';
const hashCode = (code: string) => createHash('sha256').update(`${code}:${process.env.OTP_HASH_SECRET || process.env.SESSION_SECRET || 'local-dev-only'}`).digest('hex');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { challengeId?: string; code?: string };
    const otpCode = body.code || '';
    if (!body.challengeId || !/^\d{6}$/.test(otpCode)) return NextResponse.json({ error: 'Enter the six-digit OTP.' }, { status: 400 });
    const challenge = await prisma.otpChallenge.findUnique({ where: { id: body.challengeId } });
    if (!challenge || challenge.consumedAt || challenge.expiresAt < new Date()) return NextResponse.json({ error: 'OTP expired. Request a new code.' }, { status: 400 });
    if (challenge.attempts >= 5) return NextResponse.json({ error: 'Too many incorrect attempts. Request a new OTP.' }, { status: 429 });

    let valid = false;
    if (challenge.provider === 'TWILIO') {
      const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN, service = process.env.TWILIO_VERIFY_SERVICE_SID;
      if (!sid || !token || !service) return NextResponse.json({ error: 'SMS verification provider is not configured.' }, { status: 503 });
      const credentials = Buffer.from(`${sid}:${token}`).toString('base64');
      const form = new URLSearchParams({ To: challenge.destination, Code: otpCode });
      const result = await fetch(`https://verify.twilio.com/v2/Services/${service}/VerificationCheck`, { method: 'POST', headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
      const data = await result.json() as { status?: string };
      valid = result.ok && data.status === 'approved';
    } else {
      const expected = Buffer.from(challenge.codeHash || ''), actual = Buffer.from(hashCode(otpCode));
      valid = expected.length === actual.length && timingSafeEqual(expected, actual);
    }
    if (!valid) {
      await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
      return NextResponse.json({ error: 'Incorrect OTP. Please try again.' }, { status: 400 });
    }

    const user = challenge.channel === 'email'
      ? await prisma.user.upsert({ where: { email: challenge.destination }, create: { name: challenge.name, email: challenge.destination }, update: { name: challenge.name } })
      : await prisma.user.upsert({ where: { phone: challenge.destination }, create: { name: challenge.name, phone: challenge.destination }, update: { name: challenge.name } });
    await prisma.otpChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } });
    await setSession(user.id);
    return NextResponse.json({ success: true, user: { id: user.id, permanentId: `LL-${user.id.toUpperCase()}`, name: user.name, email: user.email, phone: user.phone } });
  } catch (error) {
    console.error('verify-otp error', error);
    return NextResponse.json({ error: 'Could not verify OTP. Check server configuration.' }, { status: 500 });
  }
}
