import type { InsertUser, User } from "../drizzle/schema";
import { ENV } from "./_core/env";

/**
 * Development-only session cache for the template OAuth bridge.
 *
 * This is not a domain database. Family, tenant, consent, growth and commerce
 * data remain canonical in apps/api + PostgreSQL. Mobile authentication for
 * Family features uses the Family API Bearer session stored by the app.
 */
const sessionUsers = new Map<string, User>();
let nextSessionUserId = 1;

export async function getDb(): Promise<null> {
  return null;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const now = new Date();
  const previous = sessionUsers.get(user.openId);
  const role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : previous?.role ?? "user");
  sessionUsers.set(user.openId, {
    id: previous?.id ?? nextSessionUserId++,
    openId: user.openId,
    name: user.name ?? previous?.name ?? null,
    email: user.email ?? previous?.email ?? null,
    loginMethod: user.loginMethod ?? previous?.loginMethod ?? null,
    role,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
    lastSignedIn: user.lastSignedIn ?? now,
  });
}

export async function getUserByOpenId(openId: string): Promise<User | undefined> {
  return sessionUsers.get(openId);
}
