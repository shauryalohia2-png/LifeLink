import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/lib/auth';
export const runtime = 'nodejs';
export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json({ user: user ? { ...user, permanentId: `LL-${user.id.toUpperCase()}` } : null });
}
export async function DELETE() {
  const jar = await cookies();
  jar.set('lifelink_session', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
  return NextResponse.json({ success: true });
}
