import { Injectable, signal } from '@angular/core';

export interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
}

interface StoredSession {
  token: string;
  tokenType: string;
  expiresAt: string;
  user: AdminUser;
}

const SESSION_KEY = 'orbit-admin-session';

@Injectable({ providedIn: 'root' })
export class AdminSessionService {
  readonly user = signal<AdminUser | null>(this.read()?.user ?? null);

  token(): string | null {
    const session = this.read();
    if (!session || Date.parse(session.expiresAt) <= Date.now()) {
      this.clear();
      return null;
    }
    return session.token;
  }

  set(session: StoredSession): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
    this.user.set(session.user);
  }

  clear(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(SESSION_KEY);
    }
    this.user.set(null);
  }

  isAuthenticated(): boolean {
    return this.token() !== null;
  }

  private read(): StoredSession | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as StoredSession) : null;
    } catch {
      this.clear();
      return null;
    }
  }
}
