import { Component, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
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
import { StoreService } from '../../../core/services/store.service';
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
  private pendingViewId: number | null = null;
  todaySales: number = 0;
  private storeSub: any;

  venteToDelete: Vente | null = null;
  showDeleteModal = false;

  showEditModal = false;
  editSaleData: any = null;
  editClients: any[] = [];
  editArticles: any[] = [];
  editSelectedClient: any = null;
  editDate: string = '';
  editLines: any[] = [];
  editSelectedArticle: any = null;
  editQuantite: number = 1;
  savingEdit = false;

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
    private router: Router,
    private route: ActivatedRoute,
    public storeService: StoreService,
  ) {
    const viewId = Number(this.route.snapshot.queryParamMap.get('view'));
    if (viewId) this.pendingViewId = viewId;
    effect(() => {
      const _storeId = this.storeService.currentStoreId();
      this.loadVentes();
    });
  }

  ngOnInit(): void {
  }

  loadVentes(): void {
    const storeId = this.storeService.currentStoreId();
    this.apiService.getSales(storeId || undefined).subscribe({
      next: (data: any[]) => {
        // Regrouper les lignes de vente en reçus (group_id)
        const rows = data || [];
        const groups = new Map<number, any[]>();
        for (const s of rows) {
          const gid = s.group_id || s.id;
          if (!groups.has(gid)) groups.set(gid, []);
          groups.get(gid)!.push(s);
        }

        const sales = Array.from(groups.entries()).map(([gid, lines]) => {
          const head = lines[0];
          const montantTotal = lines.reduce((sum, l) => sum + (parseFloat(l.price) || 0), 0);
          return {
            id: gid,
            clientId: head.id_client,
            clientNom: head.client_name ? `${head.client_name} ${head.client_surname || ''}`.trim() : 'Client',
            dateVente: head.date_sate || head.created_at,
            montantTotal,
            statut: 'validee' as const,
            quantity: lines.reduce((sum, l) => sum + (l.quantity || 0), 0),
            storeId: head.store_id,
            articleName: lines.length === 1
              ? (lines[0].name_article || 'Article')
              : `${lines.length} articles`,
            articles: lines.map((l) => ({
              articleId: l.id_article,
              articleNom: l.name_article || 'Article',
              quantite: l.quantity || 1,
              prixUnitaire: (parseFloat(l.price) || 0) / (l.quantity || 1),
              sousTotal: parseFloat(l.price) || 0,
            })),
          };
        });

        this.ventes = sales as any;
        this.filteredVentes = sales as any;
        this.calculateTodaySales();
        this.openPendingView();
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

  private openPendingView(): void {
    if (!this.pendingViewId) return;
    const target = this.ventes.find((v: any) => v.id === this.pendingViewId);
    this.pendingViewId = null;
    this.router.navigate([], { queryParams: {}, replaceUrl: true });
    if (target) this.viewDetails(target);
  }

  editSale(vente: Vente): void {
    this.editSaleData = vente;
    this.showEditModal = true;
    this.editSelectedClient = null;
    this.editLines = [];
    this.editQuantite = 1;
    this.editSelectedArticle = null;
    this.editDate = new Date(vente.dateVente).toISOString().split('T')[0];

    // Load clients & articles for selects
    this.apiService.getClients().subscribe({
      next: (data: any[]) => {
        this.editClients = data.map((c: any) => ({
          label: `${c.name || c.prenom || ''} ${c.surname || c.nom || ''}`.trim() || `Client #${c.id}`,
          value: c.id,
        }));
        this.editSelectedClient = this.editClients.find(c => c.value === vente.clientId) || null;
      },
      error: () => {},
    });

    this.apiService.getArticles().subscribe({
      next: (data: any[]) => {
        this.editArticles = data.map((a: any) => ({
          label: `${a.nom} - ${a.prix} FCFA (Stock: ${a.stock})`,
          value: a.id,
          nom: a.nom,
          prix: a.prix,
          stock: a.stock,
        }));
      },
      error: () => {},
    });

    // Pre-fill lines from vente
    this.apiService.getSale(vente.id).subscribe({
      next: (sale: any) => {
        this.editLines = (sale.articles || vente.articles || []).map((a: any) => {
          const qty = a.quantity || a.quantite || 1;
          const total = parseFloat(a.price) || parseFloat(a.sousTotal) || 0;
          return {
            articleId: a.id_article || a.articleId || a.article_id,
            articleNom: a.name_article || a.articleNom || a.article_nom || 'Article',
            quantite: qty,
            prixUnitaire: total / qty,
            sousTotal: total,
          };
        });
      },
      error: () => {
        this.editLines = (vente.articles || []).map(a => ({ ...a, sousTotal: a.quantite * a.prixUnitaire }));
      },
    });
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.editSaleData = null;
  }

  addEditLine(): void {
    if (!this.editSelectedArticle || !this.editQuantite) return;
    if (this.editQuantite > this.editSelectedArticle.stock) {
      this.notificationService.error(`Stock insuffisant. Disponible: ${this.editSelectedArticle.stock}`);
      return;
    }
    const existing = this.editLines.find(l => l.articleId === this.editSelectedArticle.value);
    if (existing) {
      existing.quantite += this.editQuantite;
      existing.sousTotal = existing.quantite * existing.prixUnitaire;
    } else {
      this.editLines.push({
        articleId: this.editSelectedArticle.value,
        articleNom: this.editSelectedArticle.nom,
        quantite: this.editQuantite,
        prixUnitaire: this.editSelectedArticle.prix,
        sousTotal: this.editQuantite * this.editSelectedArticle.prix,
      });
    }
    this.editLines = [...this.editLines];
    this.editSelectedArticle = null;
    this.editQuantite = 1;
  }

  removeEditLine(index: number): void {
    this.editLines.splice(index, 1);
    this.editLines = [...this.editLines];
  }

  editSubtotal(): number {
    return this.editLines.reduce((s, l) => s + l.sousTotal, 0);
  }

  saveEdit(): void {
    if (!this.editSelectedClient || this.editLines.length === 0) {
      this.notificationService.warn('Client et articles requis');
      return;
    }
    this.savingEdit = true;
    const sale = {
      clientId: this.editSelectedClient.value,
      dateVente: this.editDate,
      montantTotal: this.editSubtotal(),
      articles: this.editLines,
    };
    this.apiService.updateVente(this.editSaleData.id, sale).subscribe({
      next: () => {
        this.notificationService.success('Vente modifiée avec succès');
        this.savingEdit = false;
        this.closeEditModal();
        this.loadVentes();
      },
      error: () => {
        this.savingEdit = false;
        this.notificationService.error('Erreur lors de la modification');
      },
    });
  }

  downloadInvoice(vente: Vente): void {
    const articlesHtml = (vente.articles || []).map((a: any) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${a.articleNom}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${a.prixUnitaire?.toLocaleString('fr-FR') || 0} F</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${a.quantite || 0}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${a.sousTotal?.toLocaleString('fr-FR') || 0} F</td>
      </tr>
    `).join('');

    const html = `
      <html>
        <head>
          <title>Facture #${vente.id}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2D5C4A; padding-bottom: 20px; }
            .logo { color: #2D5C4A; font-size: 28px; font-weight: bold; margin-bottom: 10px; }
            .info { display: flex; justify-content: space-between; margin-bottom: 20px; }
            .info div { flex: 1; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { background: #2D5C4A; color: white; padding: 10px; text-align: left; border: 1px solid #ddd; }
            td { padding: 8px; border: 1px solid #ddd; }
            .totals { text-align: right; margin-top: 20px; }
            .totals div { margin: 5px 0; }
            .total-row { font-weight: bold; font-size: 1.1em; color: #2D5C4A; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">ROOGO</div>
            <div>Facture N° ${vente.id}</div>
            <div style="margin-top: 10px; color: #666;">Date: ${new Date(vente.dateVente).toLocaleDateString('fr-FR')}</div>
          </div>
          <div class="info">
            <div><strong>Client:</strong> ${vente.clientNom}</div>
            <div><strong>Statut:</strong> ${this.getStatusLabel(vente.statut)}</div>
            <div><strong>Vente #:</strong> ${vente.id}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Article</th>
                <th style="text-align: right;">Prix unitaire</th>
                <th style="text-align: center;">Qté</th>
                <th style="text-align: right;">Sous-total</th>
              </tr>
            </thead>
            <tbody>
              ${articlesHtml}
            </tbody>
          </table>
          <div class="totals">
            <div>Sous-total HT: ${this.calculateSaleSubtotal(vente).toLocaleString('fr-FR')} F</div>
            <div>TVA (18%): ${this.calculateSaleTVA(vente).toLocaleString('fr-FR')} F</div>
            <div class="total-row">Total TTC: ${vente.montantTotal.toLocaleString('fr-FR')} F</div>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.notificationService.error('Popup bloqué. Autorisez les popups pour imprimer la facture.');
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  }

  confirmCancel(vente: Vente): void {
    this.venteToDelete = vente;
    this.showDeleteModal = true;
  }

  cancelDelete(): void {
    this.venteToDelete = null;
    this.showDeleteModal = false;
  }

  confirmDeleteAction(): void {
    if (!this.venteToDelete) return;
    const id = this.venteToDelete.id;
    this.apiService.deleteVente(id).subscribe({
      next: () => {
        this.notificationService.success('Vente annulée, stock restauré');
        this.loadVentes();
        this.cancelDelete();
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
