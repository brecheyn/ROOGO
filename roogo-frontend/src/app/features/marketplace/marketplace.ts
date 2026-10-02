import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ApiService } from '../../core/services/api.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-marketplace',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTabsModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './marketplace.html',
  styleUrls: ['./marketplace.scss'],
})
export class MarketplaceComponent implements OnInit {
  listings = signal<any[]>([]);
  syncProducts = signal<any>(null);
  alerts = signal<any[]>([]);
  isLoading = signal(true);
  activeTab = 0;

  searchQuery = '';
  orderForm = { supplier_catalog_id: null, quantity: 1, notes: '' };

  constructor(private api: ApiService, private notify: NotificationService) {}

  ngOnInit() { this.loadAll(); }

  loadAll() {
    this.isLoading.set(true);
    this.api.getMarketplaceListings({ search: this.searchQuery || undefined }).subscribe({ next: (d) => this.listings.set(d), error: () => {} });
    this.api.getEcommerceSync().subscribe({ next: (d) => { this.syncProducts.set(d); this.isLoading.set(false); }, error: () => this.isLoading.set(false) });
  }

  order(listing: any) {
    this.orderForm.supplier_catalog_id = listing.id;
    this.api.placeMarketplaceOrder(this.orderForm).subscribe({
      next: () => { this.notify.success('Commande passée !'); },
      error: (e) => this.notify.error(e?.error?.message || 'Erreur commande'),
    });
  }

  runAlerts() {
    this.api.runAutoAlerts().subscribe({
      next: (d) => { this.alerts.set(d?.alerts || []); this.notify.success(`${d?.count || 0} alerte(s) générée(s)`); },
      error: () => this.notify.error('Erreur alertes'),
    });
  }
}
