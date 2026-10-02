import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class ApiService {

  private baseUrl = ApiService.resolveBaseUrl();

  /**
   * URL de l'API :
   * 1. meta[name="roogo-api-base"] si renseignée (déploiement avec API ailleurs)
   * 2. sinon même origine "/api" — marche partout :
   *    - ng serve : proxy.conf.json → localhost:3000
   *    - backend : app servi par Express sur / → /api
   *    - Vercel : rewrite /api → fonction serverless
   */
  private static resolveBaseUrl(): string {
    const meta = document.querySelector('meta[name="roogo-api-base"]')?.getAttribute('content');
    return meta || '/api';
  }

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

  // ── SUPPLIERS ─────────────────────────────────────────────────────────────
  getSuppliers(): Observable<any[]> {
    return this.unwrap<any[]>(this.get<any>('suppliers')).pipe(catchError(() => of([])));
  }
  deleteClient(id: number): Observable<any>          { return this.del<any>(`clients/${id}`); }

  // ── SALES / VENTES ─────────────────────────────────────────────────────────
  getSales(storeId?: number): Observable<any[]> {
    const params = storeId ? `?store_id=${storeId}` : '';
    return this.unwrap<any[]>(this.get<any>('sales' + params)).pipe(catchError(() => of([])));
  }
  getVentes(storeId?: number): Observable<any[]>  { return this.getSales(storeId); }

  getSale(id: number): Observable<any>  { return this.unwrap<any>(this.get<any>(`sales/${id}`)); }
  getVente(id: number): Observable<any> { return this.getSale(id); }

  createSale(sale: any): Observable<any>             { return this.post<any>('sales', sale); }
  createVente(sale: any): Observable<any>             { return this.createSale(sale); }

  updateVente(id: number, v: any): Observable<any>   { return this.put<any>(`sales/${id}`, v); }
  deleteVente(id: number): Observable<any>            { return this.del<any>(`sales/${id}`); }

  // ── ORDERINGS / COMMANDES ──────────────────────────────────────────────────
  getOrderings(storeId?: number): Observable<any[]> {
    const params = storeId ? `?store_id=${storeId}` : '';
    return this.unwrap<any[]>(this.get<any>('orderings' + params)).pipe(catchError(() => of([])));
  }
  getOrdering(id: number): Observable<any> {
    return this.unwrap<any>(this.get<any>(`orderings/${id}`)).pipe(catchError(() => of(null)));
  }
  createOrdering(ordering: any): Observable<any> {
    return this.post<any>('orderings', ordering);
  }
  updateOrdering(id: number, data: any): Observable<any> {
    return this.put<any>(`orderings/${id}`, data);
  }
  deleteOrdering(id: number): Observable<any> {
    return this.del<any>(`orderings/${id}`);
  }
  receiveOrdering(id: number): Observable<any> {
    return this.put<any>(`orderings/${id}/receive`, {});
  }

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

  // ── AI (Sprint 6) ─────────────────────────────────────────────────────────
  aiChat(message: string): Observable<any> {
    return this.post<any>('ai/chat', { message }).pipe(catchError(() => of(null)));
  }
  aiRecommendations(): Observable<any[]> {
    return this.unwrap<any[]>(this.get<any>('ai/recommendations')).pipe(catchError(() => of([])));
  }
  aiAnomalies(): Observable<any> {
    return this.get<any>('ai/anomalies').pipe(catchError(() => of({ count: 0, critical: 0, warnings: 0, data: [] })));
  }
  aiForecasts(articleId?: number): Observable<any> {
    return this.get<any>('ai/forecasts', articleId ? { article_id: articleId } : {}).pipe(catchError(() => of(null)));
  }
  aiResolved(category: 'recommendation' | 'anomaly'): Observable<any[]> {
    return this.unwrap<any[]>(this.get<any>('ai/resolved', { category })).pipe(catchError(() => of([])));
  }
  aiResolve(payload: { category: string; item_key: string; title: string; entity_type?: string; entity_id?: number | null }): Observable<any> {
    return this.post<any>('ai/resolve', payload);
  }
  aiUnresolve(category: string, item_key: string): Observable<any> {
    return this.http.delete<any>(`${this.baseUrl}/ai/resolve`, { body: { category, item_key } });
  }

  // ── STORE MANAGEMENT (Sprint 7) ──────────────────────────────────────────
  getStores(): Observable<any[]> {
    return this.unwrap<any[]>(this.get<any>('stores')).pipe(catchError(() => of([])));
  }
  createStore(data: any): Observable<any> {
    return this.post<any>('stores', data);
  }
  updateStore(id: number, data: any): Observable<any> {
    return this.put<any>(`stores/${id}`, data);
  }
  deleteStore(id: number): Observable<any> {
    return this.del<any>(`stores/${id}`);
  }
  createStoreTransfer(data: any): Observable<any> {
    return this.post<any>('stores-management/transfers', data);
  }
  getStoreTransfers(): Observable<any[]> {
    return this.unwrap<any[]>(this.get<any>('stores-management/transfers')).pipe(catchError(() => of([])));
  }
  getStoreComparison(): Observable<any[]> {
    return this.unwrap<any[]>(this.get<any>('stores-management/comparison')).pipe(catchError(() => of([])));
  }
  getOutOfStockByStore(): Observable<any[]> {
    return this.unwrap<any[]>(this.get<any>('stores-management/out-of-stock')).pipe(catchError(() => of([])));
  }
  createApprovalRequest(data: any): Observable<any> {
    return this.post<any>('stores-management/approval', data);
  }
  approveRequest(auditLogId: number, approved: boolean, notes?: string): Observable<any> {
    return this.put<any>(`stores-management/approval/${auditLogId}`, { approved, notes });
  }
  getPendingApprovals(): Observable<any[]> {
    return this.get<any[]>('stores-management/approvals/pending').pipe(catchError(() => of([])));
  }

  // ── PAYMENTS (Sprint 8) ──────────────────────────────────────────────────
  getExchangeRates(): Observable<any> {
    return this.get<any>('payments/rates').pipe(catchError(() => of(null)));
  }
  convertCurrency(amount: number, from: string, to: string): Observable<any> {
    return this.post<any>('payments/convert', { amount, from, to }).pipe(catchError(() => of(null)));
  }
  initiatePayment(data: any): Observable<any> {
    return this.post<any>('payments/pay', data);
  }
  checkPaymentStatus(reference: string): Observable<any> {
    return this.get<any>(`payments/status/${reference}`).pipe(catchError(() => of(null)));
  }
  getPaymentHistory(): Observable<any[]> {
    return this.get<any[]>('payments/history').pipe(catchError(() => of([])));
  }

  // ── FINANCE (Sprint 9) ───────────────────────────────────────────────────
  getFIFOValuation(): Observable<any> {
    return this.get<any>('finance/fifo').pipe(catchError(() => of(null)));
  }
  getWeightedAvgValuation(): Observable<any> {
    return this.get<any>('finance/weighted-avg').pipe(catchError(() => of(null)));
  }
  getHoldingCost(params?: any): Observable<any> {
    return this.get<any>('finance/holding-cost', params).pipe(catchError(() => of(null)));
  }
  simulateScenario(scenario: string, params?: any): Observable<any> {
    return this.post<any>('finance/simulate', { scenario, params: params || {} }).pipe(catchError(() => of(null)));
  }
  getFinancialSummary(): Observable<any> {
    return this.get<any>('finance/summary').pipe(catchError(() => of(null)));
  }

  // ── MARKETPLACE (Sprint 10) ──────────────────────────────────────────────
  getMarketplaceListings(params?: any): Observable<any[]> {
    return this.get<any[]>('marketplace/listings', params).pipe(catchError(() => of([])));
  }
  placeMarketplaceOrder(data: any): Observable<any> {
    return this.post<any>('marketplace/order', data);
  }
  getEcommerceSync(): Observable<any> {
    return this.get<any>('marketplace/ecommerce/sync').pipe(catchError(() => of({ count: 0, products: [] })));
  }
  sendStockAlert(data: any): Observable<any> {
    return this.post<any>('marketplace/alerts/send', data);
  }
  runAutoAlerts(): Observable<any> {
    return this.post<any>('marketplace/alerts/run', {}).pipe(catchError(() => of({ count: 0, alerts: [] })));
  }

  // ── Mappers Backend ↔ Frontend ─────────────────────────────────────────────
  private fromApi(a: any): any {
    if (!a) return a;
    return {
      id:               a.id,
      nom:              a.name_article  ?? a.nom        ?? '',
      categorie:        a.categorie     ?? '',
      description:      a.description   ?? '',
      prix:             Number(a.unit_price ?? a.prix ?? 0),
      stock:            Number(a.quantity   ?? a.stock ?? 0),
      date_manufacture: a.date_manufacture ?? null,
      expiration_date:  a.expiration_date  ?? null,
    };
  }

  private toApi(a: any): any {
    return {
      name_article:     a.nom           ?? a.name_article ?? '',
      categorie:        a.categorie     ?? '',
      description:      a.description   ?? '',
      quantity:         Number(a.stock  ?? a.quantity     ?? 0),
      unit_price:       Number(a.prix   ?? a.unit_price   ?? 0),
      date_manufacture: a.date_manufacture ?? null,
      expiration_date:  a.expiration_date  ?? null,
    };
  }
}