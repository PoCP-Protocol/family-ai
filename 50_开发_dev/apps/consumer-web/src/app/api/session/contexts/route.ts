import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requestFamilyApi, type ContextsResponse } from '@family/web-platform';

export async function GET() {
  const cookie = (await cookies()).toString();
  const result = await requestFamilyApi<ContextsResponse>('/auth/contexts', { headers: cookie ? { cookie } : {} });
  return NextResponse.json(result.ok ? result.data : { error: result.code }, { status: result.ok ? 200 : result.status });
}
