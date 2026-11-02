import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

const COOKIE = 'lifelink_session';
function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    if (process.env.NODE_ENV !== 'production') return 'lifelink-local-development-session-secret-change-before-deploy';
    throw new Error('Set SESSION_SECRET to a random value of at least 32 characters.');
  }
  return value;
}
function sign(payload: string) { return createHmac('sha256', secret()).update(payload).digest('base64url'); }
export function createSessionToken(userId: string) {
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
export async function setSession(userId: string) {
  const jar = await cookies();
  jar.set(COOKIE, createSessionToken(userId), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
}
export async function getSessionUser() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature), b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { sub: string; exp: number };
    if (!data.sub || data.exp < Date.now()) return null;
    return await prisma.user.findUnique({ where: { id: data.sub }, select: { id: true, name: true, email: true, phone: true, createdAt: true } });
  } catch { return null; }
}
