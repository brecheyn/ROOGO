import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ApiService } from '../../../core/services/api.service';
import { StoreService } from '../../../core/services/store.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-stores-management',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTabsModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './stores-management.html',
  styleUrls: ['./stores-management.scss'],
})
export class StoresManagementComponent implements OnInit {
  comparison = signal<any[]>([]);
  transfers = signal<any[]>([]);
  outOfStock = signal<any[]>([]);
  approvals = signal<any[]>([]);
  isLoading = signal(true);
  activeTab = 0;

  transferForm = { from_store_id: null, to_store_id: null, article_id: null, quantity: 0, notes: '' };
  articles = signal<any[]>([]);
  stores = signal<any[]>([]);

  showNewStore = false;
  creatingStore = false;
  newStore = { name: '', adresse: '', phone: '', email_adresse: '' };

  showEditStore = false;
  savingStore = false;
  editStore: any = {};

  showDeleteConfirm = false;
  deletingStore = false;
  storeToDelete: any = null;

  constructor(private api: ApiService, private toast: ToastService, private storeService: StoreService) {}

  ngOnInit() { this.loadAll(); }

  loadAll() {
    this.isLoading.set(true);
    this.api.getStoreComparison().subscribe({ next: (d) => this.comparison.set(d), error: () => {} });
    this.api.getStoreTransfers().subscribe({ next: (d) => this.transfers.set(d), error: () => {} });
    this.api.getOutOfStockByStore().subscribe({ next: (d) => this.outOfStock.set(d), error: () => {} });
    this.api.getPendingApprovals().subscribe({ next: (d) => { this.approvals.set(d); this.isLoading.set(false); }, error: () => this.isLoading.set(false) });
    this.api.getArticles().subscribe({ next: (d) => this.articles.set(d), error: () => {} });
  }

  createStore() {
    if (!this.newStore.name) return;
    this.creatingStore = true;
    this.api.createStore(this.newStore).subscribe({
      next: () => {
        this.toast.success('Magasin créé avec succès');
        this.showNewStore = false;
        this.newStore = { name: '', adresse: '', phone: '', email_adresse: '' };
        this.creatingStore = false;
        this.loadAll();
        this.storeService.refreshStores();
      },
      error: (e) => {
        this.toast.error(e?.error?.message || 'Erreur lors de la création');
        this.creatingStore = false;
      }
    });
  }

  submitTransfer() {
    if (!this.transferForm.from_store_id || !this.transferForm.to_store_id || !this.transferForm.article_id || !this.transferForm.quantity) {
      this.toast.error('Veuillez remplir tous les champs');
      return;
    }
    this.api.createStoreTransfer(this.transferForm).subscribe({
      next: () => { this.toast.success('Transfert effectué'); this.loadAll(); },
      error: (e) => this.toast.error(e?.error?.message || 'Erreur transfert'),
    });
  }

  approve(id: number, approved: boolean) {
    this.api.approveRequest(id, approved).subscribe({
      next: () => { this.toast.success(approved ? 'Approuvé' : 'Rejeté'); this.loadAll(); },
      error: () => this.toast.error('Erreur approbation'),
    });
  }

  openEdit(store: any) {
    this.editStore = {
      id: store.store_id,
      name: store.store_name,
      adresse: store.adresse || '',
      phone: store.phone || '',
      email_adresse: store.email_adresse || ''
    };
    this.showEditStore = true;
  }

  updateStore() {
    if (!this.editStore.name) return;
    this.savingStore = true;
    this.api.updateStore(this.editStore.id, this.editStore).subscribe({
      next: () => {
        this.toast.success('Magasin modifié');
        this.showEditStore = false;
        this.savingStore = false;
        this.loadAll();
        this.storeService.refreshStores();
      },
      error: (e) => {
        this.toast.error(e?.error?.message || 'Erreur');
        this.savingStore = false;
      }
    });
  }

  confirmDelete(store: any) {
    this.storeToDelete = store;
    this.showDeleteConfirm = true;
  }

  cancelDelete(): void { 
    this.showDeleteConfirm = false;
    this.storeToDelete = null;
  }

  confirmDeleteAction(): void {
    if (!this.storeToDelete) return;
    const id = this.storeToDelete.store_id;
    this.deletingStore = true;
    this.api.deleteStore(id).subscribe({
      next: () => {
        this.toast.success('Magasin supprimé');
        this.showDeleteConfirm = false;
        this.deletingStore = false;
        this.storeToDelete = null;
        this.loadAll();
        this.storeService.refreshStores();
      },
      error: (e) => {
        this.toast.error(e?.error?.message || 'Erreur');
        this.deletingStore = false;
      }
    });
  }
}
