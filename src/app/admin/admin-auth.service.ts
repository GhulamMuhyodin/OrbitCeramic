import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { API_CONFIG } from '../config/api.config';
import { AdminSessionService, AdminUser } from './admin-session.service';

interface LoginResponse {
  token: string;
  tokenType: string;
  expiresAt: string;
  user: AdminUser;
}

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(AdminSessionService);

  readonly user = this.session.user;

  login(username: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${API_CONFIG.apiBase}/admin/auth/login`, { username, password })
      .pipe(tap((response) => this.session.set(response)));
  }

  logout(): Observable<unknown> {
    return this.http
      .post(`${API_CONFIG.apiBase}/admin/auth/logout`, {})
      .pipe(tap(() => this.session.clear()));
  }

  changePassword(currentPassword: string, newPassword: string): Observable<{ changed: boolean }> {
    return this.http.post<{ changed: boolean }>(
      `${API_CONFIG.apiBase}/admin/auth/password`,
      { currentPassword, newPassword },
    );
  }

  clearSession(): void {
    this.session.clear();
  }

  isAuthenticated(): boolean {
    return this.session.isAuthenticated();
  }
}
