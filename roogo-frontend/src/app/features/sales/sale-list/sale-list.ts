import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Vente } from '../../../shared/models/vente.model';

@Component({
  selector: 'app-sale-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatDialogModule,
    MatTooltipModule,
    MatCardModule,
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  templateUrl: './sale-list.html',
  styleUrls: ['./sale-list.scss'],
})
export class SaleListComponent implements OnInit {
  ventes: Vente[] = [];
  filteredVentes: Vente[] = [];
  searchTerm: string = '';
  filterStatus: string = '';
  selectedVente: Vente | null = null;
  todaySales: number = 0;

  displayedColumns: string[] = [
    'id',
    'clientNom',
    'dateVente',
    'montantTotal',
    'statut',
    'actions',
  ];

  statusOptions = [
    { label: 'Validée', value: 'validee' },
    { label: 'En attente', value: 'en_attente' },
    { label: 'Annulée', value: 'annulee' },
  ];

  constructor(
    private apiService: ApiService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadVentes();
  }

  loadVentes(): void {
    this.apiService.getVentes().subscribe({
      next: (data) => {
        this.ventes = data;
        this.filteredVentes = data;
        this.calculateTodaySales();
      },
      error: () => {
        this.ventes = this.getMockVentes();
        this.filteredVentes = this.ventes;
        this.calculateTodaySales();
      },
    });
  }

  getMockVentes(): Vente[] {
    return [
      {
        id: 1001,
        clientId: 1,
        clientNom: 'Amadou Diallo',
        dateVente: new Date(),
        montantTotal: 125000,
        statut: 'validee',
        articles: [
          {
            articleId: 1,
            articleNom: 'iPhone 15',
            quantite: 1,
            prixUnitaire: 105000,
            sousTotal: 105000,
          },
        ],
      },
      {
        id: 1002,
        clientId: 2,
        clientNom: 'Fatou Sow',
        dateVente: new Date(Date.now() - 86400000),
        montantTotal: 87500,
        statut: 'en_attente',
        articles: [
          {
            articleId: 2,
            articleNom: 'Clavier',
            quantite: 2,
            prixUnitaire: 37000,
            sousTotal: 74000,
          },
        ],
      },
    ];
  }

  applyFilters(): void {
    let filtered = [...this.ventes];

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(
        (v) =>
          v.id.toString().includes(term) ||
          (v.clientNom && v.clientNom.toLowerCase().includes(term))
      );
    }

    if (this.filterStatus) {
      filtered = filtered.filter((v) => v.statut === this.filterStatus);
    }

    this.filteredVentes = filtered;
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.filterStatus = '';
    this.filteredVentes = this.ventes;
  }

  calculateTotal(): number {
    return this.filteredVentes.reduce((sum, v) => sum + v.montantTotal, 0);
  }

  calculateAverage(): number {
    return this.filteredVentes.length > 0 ? this.calculateTotal() / this.filteredVentes.length : 0;
  }

  calculateTodaySales(): void {
    const today = new Date().setHours(0, 0, 0, 0);
    this.todaySales = this.ventes.filter(
      (v) => new Date(v.dateVente).setHours(0, 0, 0, 0) === today
    ).length;
  }

  getStatusLabel(status: string): string {
    const labels: any = { validee: 'Validée', en_attente: 'En attente', annulee: 'Annulée' };
    return labels[status] || status;
  }

  createSale(): void {
    this.router.navigate(['/sales/new']);
  }

  viewDetails(vente: Vente): void {
    this.selectedVente = vente;
  }

  editSale(vente: Vente): void {
    this.router.navigate(['/sales/edit', vente.id]);
  }

  downloadInvoice(vente: Vente): void {
    this.notificationService.info('Génération de la facture...', 'Le téléchargement va démarrer');
    setTimeout(() => {
      this.notificationService.success('Facture téléchargée', `Facture-${vente.id}.pdf`);
    }, 1500);
  }

  confirmCancel(vente: Vente): void {
    if (confirm(`Êtes-vous sûr de vouloir annuler la vente #${vente.id} ?`)) {
      this.cancelSale(vente);
    }
  }

  cancelSale(vente: Vente): void {
    this.apiService.updateVente(vente.id, { ...vente, statut: 'annulee' }).subscribe({
      next: () => {
        this.notificationService.success('Vente annulée avec succès');
        this.loadVentes();
      },
      error: () => {
        this.notificationService.error("Erreur lors de l'annulation");
      },
    });
  }

  calculateSaleSubtotal(vente: Vente): number {
    return vente.montantTotal / 1.18; // Montant HT (sans TVA)
  }

  calculateSaleTVA(vente: Vente): number {
    return this.calculateSaleSubtotal(vente) * 0.18; // TVA à 18%
  }
}
