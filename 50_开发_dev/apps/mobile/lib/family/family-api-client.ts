const DEFAULT_TIMEOUT_MS = 8_000;

export interface FamilyApiRequestSnapshot {
  activeCount: number;
  lastPath: string | null;
  lastError: string | null;
  lastResult: "unknown" | "data" | "empty";
  revision: number;
}

let requestSnapshot: FamilyApiRequestSnapshot = { activeCount: 0, lastPath: null, lastError: null, lastResult: "unknown", revision: 0 };
const requestListeners = new Set<() => void>();

export function getFamilyApiRequestSnapshot() {
  return requestSnapshot;
}

export function subscribeFamilyApiRequestSnapshot(listener: () => void) {
  requestListeners.add(listener);
  return () => requestListeners.delete(listener);
}

function updateRequestSnapshot(change: Partial<Omit<FamilyApiRequestSnapshot, "revision">>) {
  requestSnapshot = { ...requestSnapshot, ...change, revision: requestSnapshot.revision + 1 };
  requestListeners.forEach((listener) => listener());
}

const projectionCollectionKeys = new Set([
  "items", "entries", "records", "products", "offerings", "plans", "bookings", "entitlements", "activities", "contents", "posts", "orders", "assets", "services", "events", "milestones", "tasks",
]);

export function isProjectionPayloadEmpty(payload: unknown): boolean {
  if (payload === null || payload === undefined) return true;
  if (Array.isArray(payload)) return payload.length === 0;
  if (typeof payload !== "object") return false;
  const entries = Object.entries(payload as Record<string, unknown>);
  if (entries.length === 0) return true;
  const collections = entries.filter(([key, value]) => projectionCollectionKeys.has(key) && Array.isArray(value));
  return collections.length > 0 && collections.every(([, value]) => (value as unknown[]).length === 0);
}

export interface FamilyContextSummary {
  type: "FAMILY";
  family_id: string;
  person_id: string;
  membership_id: string;
  role: string;
}

export interface AccountSessionResponse {
  token: string;
  expires_at: string;
  account_id: string;
}

export interface FamilyContextsResponse {
  account_id: string;
  contexts: FamilyContextSummary[];
}

export interface ActiveOnboarding {
  onboarding_id?: string;
  family_id?: string;
  status?: string;
  [key: string]: unknown;
}

export class FamilyApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly payload: unknown,
  ) {
    super(message);
    this.name = "FamilyApiError";
  }
}

interface FamilyApiRequestOptions {
  method?: "GET" | "POST";
  token?: string | null;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

function trimBaseUrl(value: string | undefined) {
  return (value ?? "").trim().replace(/\/+$/, "");
}

export function createMobileRequestId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export class FamilyApiClient {
  readonly baseUrl: string;

  constructor(
    baseUrl = process.env.EXPO_PUBLIC_FAMILY_API_BASE_URL,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    this.baseUrl = trimBaseUrl(baseUrl);
  }

  get configured() {
    return this.baseUrl.length > 0;
  }

  private async request<T>(path: string, options: FamilyApiRequestOptions = {}): Promise<T> {
    if (!this.configured) {
      throw new FamilyApiError("Family API 尚未配置", 0, "FAMILY_API_NOT_CONFIGURED", null);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...options.headers,
    };
    if (options.token) headers.Authorization = `Bearer ${options.token}`;
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    updateRequestSnapshot({ activeCount: requestSnapshot.activeCount + 1, lastPath: path, lastError: null, lastResult: "unknown" });

    try {
      const response = await this.fetcher(`${this.baseUrl}${path}`, {
        method: options.method ?? "GET",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        credentials: "omit",
        signal: controller.signal,
      });
      const raw = await response.text();
      const payload = raw ? safeJson(raw) : null;
      if (!response.ok) {
        const code = readErrorCode(payload) ?? `HTTP_${response.status}`;
        throw new FamilyApiError(code, response.status, code, payload);
      }
      updateRequestSnapshot({ activeCount: Math.max(0, requestSnapshot.activeCount - 1), lastPath: path, lastError: null, lastResult: isProjectionPayloadEmpty(payload) ? "empty" : "data" });
      return payload as T;
    } catch (error) {
      if (error instanceof FamilyApiError) {
        updateRequestSnapshot({ activeCount: Math.max(0, requestSnapshot.activeCount - 1), lastPath: path, lastError: error.code });
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        const timeoutError = new FamilyApiError("Family API 请求超时", 0, "FAMILY_API_TIMEOUT", null);
        updateRequestSnapshot({ activeCount: Math.max(0, requestSnapshot.activeCount - 1), lastPath: path, lastError: timeoutError.code });
        throw timeoutError;
      }
      const networkError = new FamilyApiError(error instanceof Error ? error.message : "Family API 网络错误", 0, "FAMILY_API_NETWORK_ERROR", null);
      updateRequestSnapshot({ activeCount: Math.max(0, requestSnapshot.activeCount - 1), lastPath: path, lastError: networkError.code });
      throw networkError;
    } finally {
      clearTimeout(timer);
    }
  }

  issueDevAccountSession(externalRef: string) {
    return this.request<AccountSessionResponse>("/auth/account-session", {
      method: "POST",
      body: { external_ref: externalRef },
    });
  }

  getAccount(token: string) {
    return this.request<{ account_id: string; session_id: string }>("/auth/me", { token });
  }

  getContexts(token: string) {
    return this.request<FamilyContextsResponse>("/auth/contexts", { token });
  }

  revokeSession(token: string) {
    return this.request<{ revoked: boolean }>("/auth/session/revoke", { method: "POST", token });
  }

  getActiveOnboarding(token: string, familyId: string) {
    return this.request<ActiveOnboarding | null>(`/families/${familyId}/growth/onboarding/active`, { token });
  }

  getDevCoreGrowth<T>(token: string, familyId: string) {
    return this.request<T>(`/families/${familyId}/dev/core-growth`, { token });
  }

  getDevPlatformSurfaces<T>(token: string, familyId: string) {
    return this.request<T>(`/families/${familyId}/dev/platform-surfaces`, { token });
  }

  getCommerceProducts<T>(token: string, familyId: string) {
    return this.request<T>(`/families/${familyId}/orchestration/test-loop/commerce/products`, { token });
  }

  submitCommerceIntent<T>(token: string, familyId: string, body: { page_id: "UI-14"; product_ref: string; product_version: number; attributes?: Record<string, unknown> }, idempotencyKey: string) {
    return this.request<T>(`/families/${familyId}/orchestration/test-loop/commerce/order-intents`, {
      method: "POST",
      token,
      body,
      headers: {
        "idempotency-key": idempotencyKey,
        "x-correlation-id": createMobileRequestId("family-mobile-commerce"),
        "x-source": "family-ai-mobile",
      },
    });
  }

  getCommerceCustomerProjection<T>(token: string, familyId: string) {
    return this.request<T>(`/families/${familyId}/orchestration/test-loop/commerce/customer-projection`, { token });
  }

  getMembershipPlans<T>(token: string, familyId: string) {
    return this.request<T>(`/families/${familyId}/orchestration/test-loop/membership/plans`, { token });
  }

  getMembershipCustomerProjection<T>(token: string, familyId: string) {
    return this.request<T>(`/families/${familyId}/orchestration/test-loop/membership/customer-projection`, { token });
  }

  getServiceOfferings<T>(token: string, familyId: string, filters: { serviceType?: string; ageBand?: string; availableOnly?: boolean } = {}) {
    const query = new URLSearchParams({ page_id: "UI-19" });
    if (filters.serviceType) query.set("service_type", filters.serviceType);
    if (filters.ageBand) query.set("age_band", filters.ageBand);
    if (filters.availableOnly !== undefined) query.set("available_only", String(filters.availableOnly));
    return this.request<T>(`/families/${familyId}/orchestration/test-loop/services/offerings?${query.toString()}`, { token });
  }

  getServiceSlots<T>(token: string, familyId: string, serviceOfferingRef: string, serviceOfferingVersion: number) {
    const query = new URLSearchParams({
      service_offering_ref: serviceOfferingRef,
      service_offering_version: String(serviceOfferingVersion),
    });
    return this.request<T>(`/families/${familyId}/orchestration/test-loop/services/slots?${query.toString()}`, { token });
  }

  submitServiceBooking<T>(token: string, familyId: string, body: { page_id: "UI-21"; service_offering_ref: string; service_offering_version: number; availability_slot_ref: string; attributes?: Record<string, unknown> }, idempotencyKey: string) {
    return this.request<T>(`/families/${familyId}/orchestration/test-loop/services/booking-requests`, {
      method: "POST",
      token,
      body,
      headers: {
        "idempotency-key": idempotencyKey,
        "x-correlation-id": createMobileRequestId("family-mobile-service"),
        "x-source": "family-ai-mobile",
      },
    });
  }

  getServiceCustomerProjection<T>(token: string, familyId: string) {
    return this.request<T>(`/families/${familyId}/orchestration/test-loop/services/customer-projection`, { token });
  }

  recordDevFlowEvent<T>(token: string, familyId: string, body: { ui_id: string; command: string; selection?: string }, idempotencyKey: string) {
    return this.request<T>(`/families/${familyId}/dev/flow-events`, {
      method: "POST",
      token,
      body,
      headers: {
        "idempotency-key": idempotencyKey,
        "x-correlation-id": createMobileRequestId("family-mobile-correlation"),
        "x-source": "family-ai-mobile",
      },
    });
  }

  getReportExplanation<T>(token: string, familyId: string, onboardingId: string) {
    return this.request<T>(`/families/${familyId}/growth/onboardings/${onboardingId}/report-explanation`, { token });
  }

  getPlanPreview<T>(token: string, familyId: string, onboardingId: string) {
    return this.request<T>(`/families/${familyId}/growth/onboardings/${onboardingId}/plan-preview`, { token });
  }

  refreshPlanPreview<T>(token: string, familyId: string, onboardingId: string, idempotencyKey: string) {
    return this.request<T>(`/families/${familyId}/growth/onboardings/${onboardingId}/plan-preview/refresh`, {
      method: "POST",
      token,
      headers: {
        "idempotency-key": idempotencyKey,
        "x-correlation-id": createMobileRequestId("family-mobile-plan"),
        "x-source": "family-ai-mobile",
      },
    });
  }

  getServiceJourney<T>(token: string, familyId: string, onboardingId: string) {
    return this.request<T>(`/families/${familyId}/growth/onboardings/${onboardingId}/service-journey`, { token });
  }

  createPrivateCheckinDraft<T>(token: string, familyId: string, onboardingId: string, actionRef: "WEEKLY_ACTION_SEE" | "WEEKLY_ACTION_ADJUST" | "PAUSE_AND_RETURN", idempotencyKey: string) {
    return this.request<T>(`/families/${familyId}/growth/onboardings/${onboardingId}/service-journey/checkin-drafts`, {
      method: "POST",
      token,
      body: { action_ref: actionRef },
      headers: {
        "idempotency-key": idempotencyKey,
        "x-correlation-id": createMobileRequestId("family-mobile-checkin"),
        "x-source": "family-ai-mobile",
      },
    });
  }

  getGrowthProfileReadback<T>(token: string, familyId: string, onboardingId: string) {
    return this.request<T>(`/families/${familyId}/growth/onboardings/${onboardingId}/growth-profile-readback`, { token });
  }

  getFamilyReviewReadback<T>(token: string, familyId: string, onboardingId: string) {
    return this.request<T>(`/families/${familyId}/growth/onboardings/${onboardingId}/family-review-readback`, { token });
  }

  getJourneyPlan<T>(token: string, familyId: string) {
    return this.request<T>(`/families/${familyId}/growth/journey-plan`, { token });
  }
}

function safeJson(raw: string) {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return { message: raw };
  }
}

function readErrorCode(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const value = payload as Record<string, unknown>;
  if (typeof value.message === "string") return value.message;
  if (typeof value.error === "string") return value.error;
  return null;
}

export const familyApi = new FamilyApiClient();
