import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

@Component({
  selector: 'app-recommendations',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatCardModule, MatChipsModule, MatProgressSpinnerModule],
  templateUrl: './recommendations.html',
  styleUrls: ['./recommendations.scss'],
})
export class RecommendationsComponent implements OnInit {
  recos = signal<any[]>([]);
  anoms = signal<any[]>([]);
  resolved = signal<any[]>([]);
  showResolved = signal(false);
  isLoading = signal(true);
  hasError = signal(false);
  lastUpdate = signal<Date>(new Date());

  // Fusion recommandations + anomalies, triées par priorité (critique → basse)
  items = computed(() => {
    const recos = this.recos().map(r => ({ ...r, source: 'recommendation' }));
    const anoms = this.anoms().map(a => ({
      ...a,
      source: 'anomaly',
      priority: a.severity === 'critical' ? 'critical' : a.severity === 'warning' ? 'high' : 'low',
    }));
    return [...recos, ...anoms].sort((x, y) => (PRIORITY_ORDER[x.priority] ?? 4) - (PRIORITY_ORDER[y.priority] ?? 4));
  });

  constructor(private api: ApiService, private toast: ToastService, private router: Router) {}
  ngOnInit() { this.load(); }

  load() {
    this.isLoading.set(true);
    this.hasError.set(false);

    let pending = 2;
    const done = () => {
      if (--pending === 0) {
        this.isLoading.set(false);
        this.lastUpdate.set(new Date());
      }
    };

    this.api.aiRecommendations().subscribe({
      next: (data) => { this.recos.set(Array.isArray(data) ? data : []); done(); },
      error: () => { this.hasError.set(true); done(); },
    });

    this.api.aiAnomalies().subscribe({
      next: (res) => { this.anoms.set(res?.data || []); done(); },
      error: () => { this.hasError.set(true); done(); },
    });

    this.resolved.set([]);
    this.api.aiResolved('recommendation').subscribe({
      next: (list) => this.resolved.update(cur => [...cur, ...(list || []).map((r: any) => ({ ...r, category: 'recommendation' }))]),
    });
    this.api.aiResolved('anomaly').subscribe({
      next: (list) => this.resolved.update(cur => [...cur, ...(list || []).map((r: any) => ({ ...r, category: 'anomaly' }))]),
    });
  }

  categoryOf(item: any): string {
    return item.source === 'anomaly' ? 'anomaly' : 'recommendation';
  }

  keyOf(item: any): string {
    if (item.item_key) return item.item_key;
    return item.entity_type
      ? `${item.type}|${item.entity_type}|${item.entity_id}`
      : `${item.type}|${item.article_name || item.title}`;
  }

  routeFor(item: any): { commands: any[]; queryParams?: any } | null {
    switch (item.type) {
      // Recommandations
      case 'reorder':
        return item.article_id
          ? { commands: ['/orderings/new'], queryParams: { id_article: item.article_id } }
          : { commands: ['/orderings'] };
      case 'promotion':
      case 'urgent_expiry':
        return item.article_id
          ? { commands: ['/articles'], queryParams: { edit: item.article_id } }
          : { commands: ['/articles'] };
      case 'trend':
        return { commands: ['/dashboard'] };
      // Anomalies
      case 'unusual_sale':
        return { commands: ['/sales'], queryParams: { view: item.entity_id } };
      case 'negative_stock':
      case 'suspicious_adjustment':
        return { commands: ['/articles'], queryParams: { edit: item.entity_id } };
      case 'big_adjustment':
        return item.article_id
          ? { commands: ['/articles'], queryParams: { edit: item.article_id } }
          : { commands: ['/articles'] };
      default:
        return null;
    }
  }

  traiter(item: any) {
    const target = this.routeFor(item);
    if (target) this.router.navigate(target.commands, { queryParams: target.queryParams });
  }

  resolve(item: any) {
    const category = this.categoryOf(item);
    const item_key = this.keyOf(item);
    this.api.aiResolve({ category, item_key, title: item.title, entity_type: item.entity_type, entity_id: item.entity_id }).subscribe({
      next: () => {
        this.recos.update(list => list.filter(r => this.keyOf(r) !== item_key));
        this.anoms.update(list => list.filter(a => this.keyOf(a) !== item_key));
        this.resolved.update(list => [{ item_key, title: item.title, category }, ...list]);
        this.toast.success('Élément marqué comme résolu');
      },
      error: () => this.toast.error('Impossible de marquer comme résolu'),
    });
  }

  unresolve(item: any) {
    const category = item.category || 'recommendation';
    this.api.aiUnresolve(category, item.item_key).subscribe({
      next: () => {
        this.resolved.update(list => list.filter(r => r.item_key !== item.item_key || r.category !== category));
        this.toast.success('Élément réactivé');
        this.load();
      },
      error: () => this.toast.error('Impossible de réactiver'),
    });
  }

  getIcon(type: string): string {
    const icons: Record<string, string> = {
      reorder: 'shopping_cart', promotion: 'local_offer', urgent_expiry: 'error', trend: 'trending_up',
      unusual_sale: 'receipt_long', suspicious_adjustment: 'gpp_maybe', negative_stock: 'error',
      big_adjustment: 'swap_horiz',
    };
    return icons[type] || 'lightbulb';
  }

  getPriorityLabel(p: string): string {
    return { critical: 'Critique', high: 'Haute', medium: 'Moyenne', low: 'Basse' }[p] || p;
  }

  getPriorityCount(p: string): number {
    return this.items().filter(r => r.priority === p).length;
  }
}
