import { NextResponse } from 'next/server';
import { requestFamilyApi } from '@family/web-platform';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { phone?: string };
  const result = await requestFamilyApi<{ accepted: boolean }>('/auth/otp/request', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone: (body as { phone?: string }).phone }),
  });
  return NextResponse.json(result.ok ? result.data : { error: result.code }, { status: result.ok ? 200 : result.status });
}
