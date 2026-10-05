import { Component, OnInit, afterNextRender } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatDividerModule } from '@angular/material/divider';
import { ApiService } from '../../../core/services/api.service';
import { NotificationService } from '../../../core/services/notification.service';

interface SaleLine {
  articleId: number;
  articleNom: string;
  quantite: number;
  prixUnitaire: number;
  sousTotal: number;
}

@Component({
  selector: 'app-sale-form',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatDividerModule,
  ],
  templateUrl: './sale-form.html',
  styleUrls: ['./sale-form.scss'],
})
export class SaleFormComponent implements OnInit {
  clients: any[] = [];
  articles: any[] = [];
  selectedClient: any = null;
  selectedArticle: any = null;
  selectedQuantite: number = 1;
  saleLines: SaleLine[] = [];
  currentDate = new Date();
  displayedColumns: string[] = ['nom', 'quantite', 'prixUnitaire', 'sousTotal', 'actions'];

  isEditMode = false;
  editSaleId: number | null = null;

  constructor(
    private apiService: ApiService,
    private notificationService: NotificationService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    // afterNextRender runs only in browser, not during SSR
    afterNextRender(() => {
      this.loadClients();
      this.loadArticles();

      const id = this.route.snapshot.paramMap.get('id');
      if (id) {
        this.isEditMode = true;
        this.editSaleId = +id;
        this.loadSaleForEdit(this.editSaleId);
      }
    });
  }

  ngOnInit(): void {
    // Empty - everything runs in afterNextRender
  }

  loadClients(): void {
    this.apiService.getClients().subscribe({
      next: (data) => {
        this.clients = data.map((c: any) => ({
          label: `${c.name || c.prenom || ''} ${c.surname || c.nom || ''}`.trim() || `Client #${c.id}`,
          value: c.id,
          ...c,
        }));
      },
    });
  }

  loadArticles(): void {
    this.apiService.getArticles().subscribe({
      next: (data) => {
        this.articles = data.map((a: any) => ({
          label: `${a.nom} - ${a.prix} FCFA (Stock: ${a.stock})`,
          value: a.id,
          ...a,
        }));
      },
    });
  }

  loadSaleForEdit(id: number): void {
    this.apiService.getSale(id).subscribe({
      next: (sale: any) => {
        console.log('Sale loaded for edit:', sale);
        this.currentDate = new Date(sale.date_sate || sale.dateVente || sale.created_at);
        this.selectedClient = this.clients.find(c => c.value === sale.id_client) || null;
        if (!this.selectedClient && sale.id_client) {
          console.warn('Client not found in loaded list:', sale.id_client);
        }
        
        this.saleLines = (sale.articles || []).map((a: any) => {
          const qty = a.quantity || a.quantite || 1;
          const total = parseFloat(a.price) || 0;
          return {
            articleId: a.id_article || a.articleId,
            articleNom: a.name_article || a.articleNom,
            quantite: qty,
            prixUnitaire: total / qty,
            sousTotal: total,
          };
        });
      },
      error: (err) => {
        console.error('Error loading sale for edit:', err);
        this.notificationService.error('Erreur chargement vente: ' + (err.error?.message || err.message || 'Erreur'));
      }
    });
  }

  addArticle(): void {
    if (!this.selectedArticle || !this.selectedQuantite) {
      this.notificationService.warn('Veuillez sélectionner un article et une quantité');
      return;
    }

    if (this.selectedQuantite > this.selectedArticle.stock) {
      this.notificationService.error(
        `Stock insuffisant. Stock disponible: ${this.selectedArticle.stock}`
      );
      return;
    }

    const existing = this.saleLines.find((l) => l.articleId === this.selectedArticle.value);
    if (existing) {
      existing.quantite += this.selectedQuantite;
      existing.sousTotal = existing.quantite * existing.prixUnitaire;
    } else {
      this.saleLines.push({
        articleId: this.selectedArticle.value,
        articleNom: this.selectedArticle.nom,
        quantite: this.selectedQuantite,
        prixUnitaire: this.selectedArticle.prix,
        sousTotal: this.selectedQuantite * this.selectedArticle.prix,
      });
    }

    // Trigger table update
    this.saleLines = [...this.saleLines];

    this.selectedArticle = null;
    this.selectedQuantite = 1;
    this.notificationService.success('Article ajouté');
  }

  removeLine(index: number): void {
    this.saleLines.splice(index, 1);
    this.saleLines = [...this.saleLines];
  }

  calculateSubtotal(): number {
    return this.saleLines.reduce((sum, line) => sum + line.sousTotal, 0);
  }

  calculateTVA(): number {
    return this.calculateSubtotal() * 0.18;
  }

  calculateTotal(): number {
    return this.calculateSubtotal() + this.calculateTVA();
  }

  canSave(): boolean {
    return this.selectedClient && this.saleLines.length > 0;
  }

  saveSale(): void {
    if (!this.canSave()) return;

    const sale = {
      clientId: this.selectedClient.value,
      dateVente: this.currentDate,
      montantTotal: this.calculateTotal(),
      articles: this.saleLines,
    };

    const request = this.isEditMode && this.editSaleId
      ? this.apiService.updateVente(this.editSaleId, sale)
      : this.apiService.createVente(sale);

    request.subscribe({
      next: (response) => {
        this.notificationService.success(this.isEditMode ? 'Vente modifiée avec succès' : 'Vente enregistrée avec succès');
        this.router.navigate(['/sales']);
      },
      error: (err) => {
        // Affiche le message réel du serveur (ex. « Stock insuffisant pour X »)
        const serverMsg = err?.error?.message;
        this.notificationService.error(serverMsg || (this.isEditMode ? "Erreur lors de la modification" : "Erreur lors de l'enregistrement"));
      },
    });
  }

  cancel(): void {
    this.router.navigate(['/sales']);
  }
}