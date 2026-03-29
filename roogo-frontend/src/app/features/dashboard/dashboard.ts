import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NgChartsModule } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { interval, Subscription, of } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';

interface DashboardStats {
  chiffreAffairesMois: number;
  chiffreAffairesTrend: number;
  totalArticles: number;
  articlesTrend: number;
  totalClients: number;
  clientsTrend: number;
  totalVentes: number;
  ventesTrend: number;
  stockBas: number;
  panierMoyen: number;
  panierTrend: number;
}

interface TopArticle {
  nom: string;
  ventes: number;
}

interface StockAlert {
  nom: string;
  stock: number;
  type: 'bas' | 'expire';
}

interface RecentSale {
  id: number;
  clientNom: string;
  montant: number;
  date: Date;
  statut: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    NgChartsModule
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {

  private API = 'http://localhost:3000/api/dashboard';
  private isBrowser: boolean;

  stats: DashboardStats = this.emptyStats();
  topArticles: TopArticle[] = [];
  stockAlerts: StockAlert[] = [];
  recentSales: RecentSale[] = [];
  salesChartData!: ChartConfiguration<'line'>['data'];

  displayedColumns = ['clientNom', 'montant', 'date', 'statut'];
  lastUpdate = new Date();
  isLoading = false;
  hasError = false;

  private refreshSub?: Subscription;

  chartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: string | number) =>
            Number(value) >= 1000
              ? (Number(value) / 1000).toFixed(0) + 'k F'
              : value + ' F'
        }
      }
    }
  };

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  // ===============================
  // Lifecycle
  // ===============================

  ngOnInit(): void {
    if (this.isBrowser) {
      this.loadAll();
      this.startAutoRefresh();
    }
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
  }

  // ===============================
  // Data Loading
  // ===============================

  loadAll(): void {
    this.isLoading = true;
    this.hasError = false;

    this.get<DashboardStats>('stats').subscribe({
      next: (data) => {
        this.stats = data ?? this.emptyStats();
        this.isLoading = false;
        this.lastUpdate = new Date();
      },
      error: () => {
        this.isLoading = false;
        this.hasError = true;
      }
    });

    this.get<TopArticle[]>('top-articles?limit=5')
      .subscribe(data => this.topArticles = data ?? []);

    this.get<StockAlert[]>('stock-alerts')
      .subscribe(data => this.stockAlerts = data ?? []);

    this.get<RecentSale[]>('recent-sales?limit=5')
      .subscribe(data => {
        this.recentSales = (data ?? []).map((s: RecentSale) => ({
          ...s,
          date: new Date(s.date)
        }));
      });

    this.get<ChartConfiguration<'line'>['data']>('sales-chart?days=7')
      .subscribe(data => {
        data ? this.salesChartData = data : this.initEmptyChart();
      });
  }

  startAutoRefresh(): void {
    if (!this.isBrowser) return;

    this.refreshSub = interval(30000).pipe(
      switchMap(() =>
        this.get<DashboardStats>('stats')
          .pipe(catchError(() => of(null)))
      )
    ).subscribe(data => {
      if (data) {
        this.stats = data;
        this.lastUpdate = new Date();
      }
    });
  }

  manualRefresh(): void {
    this.loadAll();
  }

  // ===============================
  // UI Helpers
  // ===============================

  getTrendIcon(trend: number): string {
    return trend > 0 ? 'trending_up'
         : trend < 0 ? 'trending_down'
         : 'trending_flat';
  }

  getTrendClass(trend: number): string {
    return trend > 0 ? 'trend-up'
         : trend < 0 ? 'trend-down'
         : 'trend-neutral';
  }

  getStatusClass(statut: string): string {
    switch (statut?.toLowerCase()) {
      case 'validée': return 'status-success';
      case 'en attente': return 'status-warning';
      case 'annulée': return 'status-danger';
      default: return 'status-info';
    }
  }

  getArticleBarWidth(index: number): string {
    if (!this.topArticles.length) return '0%';
    const max = this.topArticles[0]?.ventes || 1;
    return ((this.topArticles[index]?.ventes / max) * 100) + '%';
  }

  // ===============================
  // Helpers
  // ===============================

  private get<T>(endpoint: string) {
    return this.http.get<T>(`${this.API}/${endpoint}`)
      .pipe(catchError(() => of(null as any)));
  }

  private emptyStats(): DashboardStats {
    return {
      chiffreAffairesMois: 0,
      chiffreAffairesTrend: 0,
      totalArticles: 0,
      articlesTrend: 0,
      totalClients: 0,
      clientsTrend: 0,
      totalVentes: 0,
      ventesTrend: 0,
      stockBas: 0,
      panierMoyen: 0,
      panierTrend: 0
    };
  }

  private initEmptyChart(): void {
    this.salesChartData = {
      labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
      datasets: [{
        data: [0, 0, 0, 0, 0, 0, 0],
        borderColor: '#2D5C4A',
        backgroundColor: 'rgba(45, 92, 74, 0.1)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#2D5C4A',
        pointRadius: 4
      }]
    };
  }
}