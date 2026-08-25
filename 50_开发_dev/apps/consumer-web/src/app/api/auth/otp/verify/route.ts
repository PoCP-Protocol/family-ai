import { NextResponse } from 'next/server';
import { requestFamilyApi } from '@family/web-platform';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { phone?: string; code?: string };
  const result = await requestFamilyApi<{ authenticated: boolean }>('/auth/otp/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone: (body as { phone?: string; code?: string }).phone, code: (body as { phone?: string; code?: string }).code }),
  });
  if (!result.ok) return NextResponse.json({ error: result.code }, { status: result.status });
  const response = NextResponse.json(result.data);
  const setCookie = result.headers?.get('set-cookie');
  if (setCookie) response.headers.append('set-cookie', setCookie);
  return response;
}
