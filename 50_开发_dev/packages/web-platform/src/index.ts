export type ApiErrorCode = 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'UNAVAILABLE' | 'UNKNOWN';
export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; code: ApiErrorCode; message: string };
export type SessionState = 'loading' | 'authenticated' | 'unauthenticated' | 'expired' | 'unavailable';
export type FamilyContext = { familyId: string; displayName: string; role: string };
export type ProjectionEnvelope<T> = { projection: T; source: 'family-api'; generatedAt?: string; traceId?: string };
export const consumerRoutes = ['/login','/onboarding','/select-family','/today','/growth/assessment','/growth/plan','/growth/journey','/today/action','/growth/review','/services','/mine/family'] as const;
export const opsRoutes = ['/overview','/families','/journeys','/assessments','/services','/safety','/audit','/settings'] as const;
export const canDisplayOpsSurface = (role: string) => ['PLATFORM_ADMIN','TENANT_ADMIN','TENANT_OPERATOR','SERVICE_ADVISOR'].includes(role);
export const isApiError = (value: unknown): value is { status: number; code: ApiErrorCode } => typeof value === 'object' && value !== null && 'status' in value && 'code' in value;
