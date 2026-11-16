// Sized to the container (512 MB, heap about 259 MB) at about 1 MB per
// session; 500 could exhaust the heap before the cap was reached (M6).
const MAX_SESSIONS = 150;
// Per user: clients that never send DELETE (or reconnect often) cannot hold
// more than this; the least recently used session of that user is closed.
const MAX_SESSIONS_PER_USER = 10;
// Idle expiry. A client whose session is gone gets 404 and re-initialises.
const SESSION_TTL = 2 * 60 * 60 * 1000; // 2 hours idle
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export interface SessionData {
  transport: unknown;
  server: unknown;
  token: string;
  userId: string;
  isAdmin: boolean;
  createdAt: number;
  lastSeenAt?: number;
}

export class McpSessionStore {
  private sessions = new Map<string, SessionData>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref();
  }

  // Stäng transport + MCP-server så SSE-strömmar och resurser inte läcker. Idempotent-tåligt:
  // sessionen tas bort ur mappen INNAN close() (som kan trigga transport.onclose→delete igen).
  private closeResources(session: SessionData): void {
    try {
      (session.transport as { close?: () => unknown } | null)?.close?.();
    } catch {
      /* ignore */
    }
    try {
      (session.server as { close?: () => unknown } | null)?.close?.();
    } catch {
      /* ignore */
    }
  }

  get(id: string): SessionData | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;

    // Förnya TTL vid användning så en aktiv session inte dödas mitt i en konversation.
    if (Date.now() - (session.lastSeenAt ?? session.createdAt) > SESSION_TTL) {
      this.delete(id);
      return undefined;
    }

    session.lastSeenAt = Date.now();
    return session;
  }

  set(id: string, data: SessionData): boolean {
    if (!this.sessions.has(id)) {
      this.cleanup();
      const own = [...this.sessions.entries()].filter(([, v]) => v.userId === data.userId);
      if (own.length >= MAX_SESSIONS_PER_USER) this.delete(this.leastRecentlyUsed(own));
      if (this.sessions.size >= MAX_SESSIONS) {
        this.delete(this.leastRecentlyUsed([...this.sessions.entries()]));
      }
    }
    this.sessions.set(id, data);
    return true;
  }

  private leastRecentlyUsed(entries: Array<[string, SessionData]>): string {
    const lastUse = (v: SessionData) => v.lastSeenAt ?? v.createdAt;
    return entries.reduce((a, b) => (lastUse(b[1]) < lastUse(a[1]) ? b : a))[0];
  }

  delete(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    this.sessions.delete(id); // ta bort först → undvik re-entrancy via onclose
    this.closeResources(session);
    return true;
  }

  count(): number {
    return this.sessions.size;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - (session.lastSeenAt ?? session.createdAt) > SESSION_TTL) {
        this.delete(id);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupTimer);
    for (const id of [...this.sessions.keys()]) {
      this.delete(id);
    }
  }
}
