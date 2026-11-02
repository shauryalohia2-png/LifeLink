import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomInt } from 'node:crypto';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
const hashCode = (code: string) => createHash('sha256').update(`${code}:${process.env.OTP_HASH_SECRET || process.env.SESSION_SECRET || 'local-dev-only'}`).digest('hex');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { name?: string; channel?: string; destination?: string };
    const name = body.name?.trim();
    const channel = body.channel;
    const destination = body.destination?.trim();
    if (!name || name.length > 100 || !destination || destination.length > 180 || !['email', 'phone'].includes(channel || '')) {
      return NextResponse.json({ error: 'Enter your name and a valid email address or mobile number.' }, { status: 400 });
    }
    const normalized = channel === 'email' ? destination.toLowerCase() : destination.replace(/[\s()-]/g, '');
    if (channel === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    if (channel === 'phone' && !/^\+?[1-9]\d{7,14}$/.test(normalized)) return NextResponse.json({ error: 'Enter a valid phone number with country code, e.g. +919876543210.' }, { status: 400 });

    const recent = await prisma.otpChallenge.count({ where: { destination: normalized, createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) } } });
    if (recent >= 3) return NextResponse.json({ error: 'Too many OTP requests. Please wait 10 minutes and try again.' }, { status: 429 });

    let provider = 'LOCAL';
    let codeHash: string | null = null;
    if (process.env.NODE_ENV === 'production' && process.env.LIFELINK_DEV_OTP === 'true') {
      return NextResponse.json({ error: 'Development OTP mode cannot be enabled in production.' }, { status: 500 });
    }
    if (channel === 'email') {
      const code = String(randomInt(100000, 1000000));
      if (process.env.RESEND_API_KEY && process.env.RESEND_FROM) {
        const send = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: process.env.RESEND_FROM, to: [normalized], subject: 'Your LifeLink verification code', html: `<p>Your LifeLink verification code is <strong>${code}</strong>.</p><p>It expires in 5 minutes. Do not share this code.</p>` }) });
        if (!send.ok) return NextResponse.json({ error: 'Email delivery failed. Check your email provider configuration.' }, { status: 502 });
        provider = 'RESEND';
      } else if (process.env.NODE_ENV !== 'production' && process.env.LIFELINK_DEV_OTP === 'true') {
        provider = 'LOCAL';
      } else return NextResponse.json({ error: 'Email OTP is not configured. Add RESEND_API_KEY and RESEND_FROM to .env.' }, { status: 503 });
      codeHash = hashCode(code);
      const challenge = await prisma.otpChallenge.create({ data: { channel, destination: normalized, name, codeHash, provider, expiresAt: new Date(Date.now() + 5 * 60 * 1000) } });
      return NextResponse.json({ challengeId: challenge.id, message: `OTP sent to ${normalized}.`, ...(provider === 'LOCAL' ? { developmentOtp: code } : {}) });
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID, authToken = process.env.TWILIO_AUTH_TOKEN, serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
    if (accountSid && authToken && serviceSid) {
      const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
      const form = new URLSearchParams({ To: normalized, Channel: 'sms' });
      const sent = await fetch(`https://verify.twilio.com/v2/Services/${serviceSid}/Verifications`, { method: 'POST', headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
      if (!sent.ok) return NextResponse.json({ error: 'SMS OTP could not be sent. Check your Twilio Verify configuration.' }, { status: 502 });
      provider = 'TWILIO';
    } else if (process.env.NODE_ENV !== 'production' && process.env.LIFELINK_DEV_OTP === 'true') {
      provider = 'LOCAL';
      const code = '123456';
      codeHash = hashCode(code);
    } else return NextResponse.json({ error: 'SMS OTP is not configured. Add Twilio Verify credentials to .env.' }, { status: 503 });
    const challenge = await prisma.otpChallenge.create({ data: { channel, destination: normalized, name, codeHash, provider, expiresAt: new Date(Date.now() + 5 * 60 * 1000) } });
    return NextResponse.json({ challengeId: challenge.id, message: `OTP sent to ${normalized}.`, ...(provider === 'LOCAL' ? { developmentOtp: '123456' } : {}) });
  } catch (error) {
    console.error('send-otp error', error);
    return NextResponse.json({ error: 'Could not start verification. Check database and server configuration.' }, { status: 500 });
  }
}
