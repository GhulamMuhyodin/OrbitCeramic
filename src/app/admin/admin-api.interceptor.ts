import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, finalize, throwError } from 'rxjs';
import { ApiLoadingService } from '../services/api-loading.service';
import { AdminSessionService } from './admin-session.service';

/** Attach the database session bearer token to every protected admin request. */
export const adminApiInterceptor: HttpInterceptorFn = (req, next) => {
  const loader = inject(ApiLoadingService);
  const session = inject(AdminSessionService);
  const url = req.url;
  const isProtectedAdminRequest =
    url.includes('/api/v1/admin/') ||
    url.endsWith('/api/v1/media') ||
    url.includes('/api/v1/media?');

  const headers: Record<string, string> = {};
  const token = session.token();
  if (token && isProtectedAdminRequest) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const request = Object.keys(headers).length ? req.clone({ setHeaders: headers }) : req;

  loader.start();
  return next(request).pipe(
    catchError((error) => {
      if (error?.status === 401) {
        session.clear();
      }
      return throwError(() => error);
    }),
    finalize(() => loader.stop()),
  );
};
