import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class ApiService {

  private baseUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  // ── Utilitaires ────────────────────────────────────────────────────────────
  private buildParams(params?: any): HttpParams {
    let p = new HttpParams();
    if (params) {
      Object.keys(params).forEach(k => {
        if (params[k] !== null && params[k] !== undefined) p = p.set(k, params[k]);
      });
    }
    return p;
  }

  private unwrap<T>(obs: Observable<any>): Observable<T> {
    return obs.pipe(
      map((res: any) => (res && typeof res === 'object' && 'data' in res ? res.data : res) as T)
    );
  }

  private get<T>(endpoint: string, params?: any): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}/${endpoint}`, { params: this.buildParams(params) });
  }
  private post<T>(endpoint: string, data: any): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}/${endpoint}`, data);
  }
  private put<T>(endpoint: string, data: any): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}/${endpoint}`, data);
  }
  private del<T>(endpoint: string): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}/${endpoint}`);
  }

  // ── DASHBOARD ──────────────────────────────────────────────────────────────
  getDashboardStats(): Observable<any> {
    return this.get<any>('dashboard/stats').pipe(catchError(() => of(null)));
  }
  getTopArticles(limit = 5): Observable<any[]> {
    return this.get<any[]>('dashboard/top-articles', { limit }).pipe(catchError(() => of([])));
  }
  getStockAlerts(): Observable<any[]> {
    return this.get<any[]>('dashboard/stock-alerts').pipe(catchError(() => of([])));
  }
  getRecentSales(limit = 5): Observable<any[]> {
    return this.get<any[]>('dashboard/recent-sales', { limit }).pipe(catchError(() => of([])));
  }
  getSalesChart(days = 7): Observable<any> {
    return this.get<any>('dashboard/sales-chart', { days }).pipe(catchError(() => of(null)));
  }

  // ── ARTICLES ───────────────────────────────────────────────────────────────
  getArticles(): Observable<any[]> {
    return this.unwrap<any[]>(this.get<any>('articles')).pipe(
      map((list: any[]) => (list || []).map((a: any) => this.fromApi(a))),
      catchError(() => of([]))
    );
  }
  getArticle(id: number): Observable<any> {
    return this.unwrap<any>(this.get<any>(`articles/${id}`)).pipe(
      map((a: any) => this.fromApi(a)),
      catchError(() => of(null))
    );
  }
  createArticle(article: any): Observable<any> {
    return this.post<any>('articles', this.toApi(article));
  }
  updateArticle(id: number, article: any): Observable<any> {
    return this.put<any>(`articles/${id}`, this.toApi(article));
  }
  deleteArticle(id: number): Observable<any> {
    return this.del<any>(`articles/${id}`);
  }

  // ── CLIENTS ───────────────────────────────────────────────────────────────
  getClients(): Observable<any[]> {
    return this.unwrap<any[]>(this.get<any>('clients')).pipe(catchError(() => of([])));
  }
  getClient(id: number): Observable<any> {
    return this.unwrap<any>(this.get<any>(`clients/${id}`));
  }
  createClient(c: any): Observable<any>             { return this.post<any>('clients', c); }
  updateClient(id: number, c: any): Observable<any> { return this.put<any>(`clients/${id}`, c); }
  deleteClient(id: number): Observable<any>          { return this.del<any>(`clients/${id}`); }

  // ── SALES / VENTES ─────────────────────────────────────────────────────────
  getSales(): Observable<any[]> {
    return this.unwrap<any[]>(this.get<any>('sales')).pipe(catchError(() => of([])));
  }
  getVentes(): Observable<any[]>  { return this.getSales(); }

  getSale(id: number): Observable<any>  { return this.unwrap<any>(this.get<any>(`sales/${id}`)); }
  getVente(id: number): Observable<any> { return this.getSale(id); }

  createSale(sale: any): Observable<any>             { return this.post<any>('sales', sale); }
  createVente(sale: any): Observable<any>             { return this.createSale(sale); }

  updateVente(id: number, v: any): Observable<any>   { return this.put<any>(`sales/${id}`, v); }
  deleteVente(id: number): Observable<any>            { return this.del<any>(`sales/${id}`); }

  // ── ADMIN ─────────────────────────────────────────────────────────────────
  generateAIReport(): Observable<any> {
    return this.get<any>('admin/reports/ai').pipe(catchError(() => of(null)));
  }
  exportToExcel(params: any): Observable<Blob> {
    return this.http.post(`${this.baseUrl}/admin/export/excel`, params, { responseType: 'blob' });
  }
  exportToPDF(params: any): Observable<Blob> {
    return this.http.post(`${this.baseUrl}/admin/export/pdf`, params, { responseType: 'blob' });
  }

  // ── Mappers Backend ↔ Frontend ─────────────────────────────────────────────
  private fromApi(a: any): any {
    if (!a) return a;
    return {
      id:               a.id,
      nom:              a.name_article  ?? a.nom        ?? '',
      categorie:        a.categorie     ?? '',
      description:      a.description   ?? '',
      prix:             a.unit_price    ?? a.prix       ?? 0,
      stock:            a.quantity      ?? a.stock      ?? 0,
      date_manufacture: a.date_manufacture ?? null,
      expiration_date:  a.expiration_date  ?? null,
    };
  }

  private toApi(a: any): any {
    return {
      name_article:     a.nom           ?? a.name_article ?? '',
      categorie:        a.categorie     ?? '',
      quantity:         a.stock         ?? a.quantity     ?? 0,
      unit_price:       a.prix          ?? a.unit_price   ?? 0,
      date_manufacture: a.date_manufacture ?? null,
      expiration_date:  a.expiration_date  ?? null,
    };
  }
}