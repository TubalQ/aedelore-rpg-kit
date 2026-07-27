const MAX_SESSIONS = 500;
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours
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
    // Allow overwriting an existing session (same id)
    if (!this.sessions.has(id) && this.sessions.size >= MAX_SESSIONS) {
      console.warn("[session-store] Max sessions reached, rejecting new session");
      return false;
    }

    this.sessions.set(id, data);
    return true;
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
