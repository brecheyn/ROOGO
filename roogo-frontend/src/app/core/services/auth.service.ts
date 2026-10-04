import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { User } from '../../shared/models/user.model'; 

import { resolveApiBase } from '../api-base';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private API = resolveApiBase() + '/auth';
  private isBrowser: boolean;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    if (this.isBrowser) {
      const stored = localStorage.getItem('user');
      if (stored) this.currentUserSubject.next(JSON.parse(stored));
    }
  }

  // Fix : login accepte un objet { username, password }
  login(credentials: { username: string; password: string }): Observable<any> {
    return this.http.post<any>(`${this.API}/login`, credentials).pipe(
      tap(res => { if (res.success) this.storeSession(res); })
    );
  }

  signup(data: any): Observable<any> {
    return this.http.post<any>(`${this.API}/signup`, data).pipe(
      tap(res => { if (res.success) this.storeSession(res); })
    );
  }

  private storeSession(res: any): void {
    if (!this.isBrowser) return;
    localStorage.setItem('token', res.token);
    localStorage.setItem('user', JSON.stringify(res.user));
    if (res.user?.organizationSlug) {
      localStorage.setItem('organizationSlug', res.user.organizationSlug);
    }
    this.currentUserSubject.next(res.user);
  }

  logout(): void {
    if (this.isBrowser) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('organizationSlug');
    }
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  getCurrentUser(): User | null { return this.currentUserSubject.value; }
  getToken(): string | null { return this.isBrowser ? localStorage.getItem('token') : null; }
  isAuthenticated(): boolean { return !!this.getToken(); }
}
