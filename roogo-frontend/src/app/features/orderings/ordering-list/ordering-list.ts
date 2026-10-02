import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { StoreService } from '../../../core/services/store.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-ordering-list',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatTooltipModule],
  templateUrl: './ordering-list.html',
  styleUrls: ['./ordering-list.scss']
})
export class OrderingListComponent implements OnInit {
  orderings: any[] = [];
  filtered: any[] = [];
  loading = true;
  searchTerm = '';
  filterStatus = '';
  receivingId: number | null = null;

  allArticles: any[] = [];
  allSuppliers: any[] = [];

  showEditModal = false;
  savingEdit = false;
  editData: any = {};

  showDeleteConfirm = false;
  deleting = false;
  deleteTarget: any = null;

  constructor(private api: ApiService, private router: Router, public storeService: StoreService, private toast: ToastService) {}

  ngOnInit() {
    this.loadOrderings();
    this.loadArticlesAndSuppliers();
  }

  loadArticlesAndSuppliers() {
    this.api.getArticles().subscribe({ next: (d: any) => this.allArticles = Array.isArray(d) ? d : [], error: () => {} });
    this.api.getSuppliers().subscribe({ next: (d: any) => this.allSuppliers = Array.isArray(d) ? d : [], error: () => {} });
  }

  loadOrderings() {
    this.loading = true;
    const storeId = this.storeService.currentStoreId();
    this.api.getOrderings(storeId || undefined).subscribe({
      next: (data: any) => {
        this.orderings = Array.isArray(data) ? data : [];
        this.applyFilter();
        this.loading = false;
      },
      error: () => {
        this.orderings = [];
        this.filtered = [];
        this.loading = false;
        this.toast.error('Échec du chargement des commandes');
      }
    });
  }

  applyFilter() {
    let result = [...this.orderings];
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(o =>
        (o.name_article || '').toLowerCase().includes(term) ||
        (o.supplier_name || '').toLowerCase().includes(term)
      );
    }
    if (this.filterStatus) {
      result = result.filter(o =>
        this.filterStatus === 'received' ? this.isReceived(o) : !this.isReceived(o)
      );
    }
    this.filtered = result;
  }

  resetFilters() {
    this.searchTerm = '';
    this.filterStatus = '';
    this.applyFilter();
  }

  isReceived(ordering: any): boolean {
    return !!ordering.receved_date;
  }

  getTotalCommandes(): number { return this.orderings.length; }
  getCommandesEnAttente(): number { return this.orderings.filter(o => !this.isReceived(o)).length; }
  getCommandesRecues(): number { return this.orderings.filter(o => this.isReceived(o)).length; }
  getTotalMontant(): number { return this.orderings.reduce((sum, o) => sum + (parseFloat(o.price) || 0), 0); }

  receiveOrdering(ordering: any) {
    this.receivingId = ordering.id;
    this.api.receiveOrdering(ordering.id).subscribe({
      next: () => {
        ordering.receved_date = new Date().toISOString();
        this.toast.success(`Commande #${ordering.id} marquée comme reçue`);
        this.receivingId = null;
      },
      error: () => {
        this.toast.error('Erreur lors de la réception');
        this.receivingId = null;
      }
    });
  }

  createOrdering() {
    this.router.navigate(['/orderings/new']);
  }

  openEdit(ordering: any) {
    this.editData = {
      id: ordering.id,
      id_article: ordering.id_article,
      id_supplier: ordering.id_supplier,
      quantity: ordering.quantity,
      price: ordering.price
    };
    this.showEditModal = true;
  }

  updateOrdering() {
    if (!this.editData.id_article || !this.editData.id_supplier || !this.editData.quantity || !this.editData.price) return;
    this.savingEdit = true;
    this.api.updateOrdering(this.editData.id, {
      id_article: Number(this.editData.id_article),
      id_supplier: Number(this.editData.id_supplier),
      quantity: Number(this.editData.quantity),
      price: Number(this.editData.price)
    }).subscribe({
      next: () => {
        this.toast.success('Commande modifiée');
        this.showEditModal = false;
        this.savingEdit = false;
        this.loadOrderings();
      },
      error: (e) => {
        this.toast.error(e?.error?.message || 'Erreur');
        this.savingEdit = false;
      }
    });
  }

  confirmDelete(ordering: any) {
    this.deleteTarget = ordering;
  }

  cancelDelete(): void { this.deleteTarget = null; }

  confirmDeleteAction(): void {
    if (!this.deleteTarget) return;
    const id = this.deleteTarget.id;
    this.deleting = true;
    this.api.deleteOrdering(id).subscribe({
      next: () => {
        this.toast.success('Commande supprimée');
        this.deleting = false;
        this.deleteTarget = null;
        this.loadOrderings();
      },
      error: (e) => {
        this.toast.error(e?.error?.message || 'Erreur');
        this.deleting = false;
      }
    });
  }
}
