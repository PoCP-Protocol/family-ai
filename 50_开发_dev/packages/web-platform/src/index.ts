export type ApiErrorCode = 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'UNAVAILABLE' | 'UNKNOWN';
export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; code: ApiErrorCode; message: string };
export type SessionState = 'loading' | 'authenticated' | 'unauthenticated' | 'expired' | 'unavailable';
export type FamilyContext = { familyId: string; displayName: string; role: string; tenantId?: string };
export type ProjectionEnvelope<T> = { projection: T; source: 'family-api'; generatedAt?: string; traceId?: string };
export const consumerRoutes = ['/login','/onboarding','/select-family','/today','/growth/assessment','/growth/assessment/[sessionId]','/growth/interpretation/[sessionId]','/growth/plan','/growth/journey','/today/action','/growth/review','/services','/mine/family'] as const;
export const opsRoutes = ['/overview','/families','/families/[familyId]','/journeys','/assessments','/services','/safety','/audit','/settings'] as const;
export const canDisplayOpsSurface = (role: string) => ['PLATFORM_ADMIN','TENANT_ADMIN','TENANT_OPERATOR','SERVICE_ADVISOR'].includes(role);
export const isApiError = (value: unknown): value is { status: number; code: ApiErrorCode } => typeof value === 'object' && value !== null && 'status' in value && 'code' in value;

export type SessionMe = { account_id: string; phone_masked?: string };
export type ContextsResponse = { account_id: string; contexts: FamilyContext[] };
export type FamilyHomeProjection = { family?: { display_name?: string }; primary_action?: { assignment_text?: string; status?: string }; journey?: { current_phase?: string; status?: string }; milestones?: unknown[]; services?: unknown[] };

const errorCodeForStatus = (status: number): ApiErrorCode => status === 401 ? 'UNAUTHORIZED' : status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : status >= 500 ? 'UNAVAILABLE' : 'UNKNOWN';

/** Server-side BFF primitive. It forwards the HttpOnly cookie and never accepts a client bearer token. */
export async function requestFamilyApi<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
	const baseUrl = process.env.FAMILY_API_URL ?? 'http://localhost:3000';
	try {
		const response = await fetch(new URL(path, baseUrl), { ...init, headers: { accept: 'application/json', ...(init.headers ?? {}) }, cache: 'no-store' });
		if (!response.ok) return { ok: false, status: response.status, code: errorCodeForStatus(response.status), message: await response.text() || 'family_api_request_failed' };
		return { ok: true, data: await response.json() as T };
	} catch {
		return { ok: false, status: 503, code: 'UNAVAILABLE', message: 'family_api_unavailable' };
	}
}
