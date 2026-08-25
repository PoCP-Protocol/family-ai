import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { requestFamilyApi, type FamilyHomeProjection } from '@family/web-platform';

type Params = { params: Promise<{ familyId: string }> };

export async function GET(_: Request, { params }: Params) {
  const { familyId } = await params;
  const cookie = (await cookies()).toString();
  const result = await requestFamilyApi<FamilyHomeProjection>(`/families/${encodeURIComponent(familyId)}/ui/01/home`, { headers: cookie ? { cookie } : {} });
  return NextResponse.json(result.ok ? result.data : { error: result.code }, { status: result.ok ? 200 : result.status });
}
