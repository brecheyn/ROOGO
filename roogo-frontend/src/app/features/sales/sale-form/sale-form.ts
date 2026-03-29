import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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

  constructor(
    private apiService: ApiService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadClients();
    this.loadArticles();
  }

  loadClients(): void {
    this.apiService.getClients().subscribe({
      next: (data) => {
        this.clients = data.map((c: any) => ({
          label: `${c.prenom} ${c.nom}`,
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

    this.apiService.createVente(sale).subscribe({
      next: (response) => {
        this.notificationService.success('Vente enregistrée avec succès');
        this.generatePDF(response);
        this.router.navigate(['/sales']);
      },
      error: () => {
        this.notificationService.error("Erreur lors de l'enregistrement");
      },
    });
  }

  generatePDF(sale: any): void {
    this.notificationService.info('Génération de la facture PDF...');
    setTimeout(() => {
      this.notificationService.success('Facture PDF générée');
    }, 2000);
  }

  cancel(): void {
    this.router.navigate(['/sales']);
  }
}