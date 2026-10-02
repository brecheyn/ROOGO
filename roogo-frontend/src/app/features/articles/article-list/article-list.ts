import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { ApiService } from '../../../core/services/api.service';
import { ArticleDialogComponent } from '../article-form/article-form';
import { FilterByConditionPipe } from '../../../shared/pipes/filter.pipe';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-article-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatTableModule, MatButtonModule,
    MatInputModule, MatIconModule, MatDialogModule,
    MatCardModule, MatFormFieldModule, MatSelectModule,
    MatProgressSpinnerModule, MatTooltipModule, MatChipsModule,
    FilterByConditionPipe
  ],
  templateUrl: './article-list.html',
  styleUrls: ['./article-list.scss'],
})
export class ArticleListComponent implements OnInit {
  articles: any[] = [];
  filteredArticles: any[] = [];
  searchTerm = '';
  selectedCategory = 'all';
  categories: string[] = [];
  displayedColumns = ['nom', 'categorie', 'description', 'prix', 'stock', 'expiration_date', 'actions'];
  isLoading = false;

  articleToDelete: any = null;
  showDeleteModal = false;
  private pendingEditId: number | null = null;

  constructor(
    private api: ApiService,
    private dialog: MatDialog,
    private toast: ToastService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    const editId = Number(this.route.snapshot.queryParamMap.get('edit'));
    if (editId) this.pendingEditId = editId;
    this.loadArticles();
  }

  loadArticles(): void {
    this.isLoading = true;
    this.api.getArticles().subscribe({
      next: (data: any[]) => {
        this.articles = data;
        this.filteredArticles = data;
        this.extractCategories();
        this.isLoading = false;
        this.openPendingEdit();
      },
      error: (err: any) => {
        console.error('Erreur chargement articles:', err);
        this.toast.error(`Échec du chargement: ${err.message || err.error?.message || 'Erreur inconnue'}`);
        this.isLoading = false;
      }
    });
  }

  extractCategories(): void {
    this.categories = [...new Set(this.articles.map((a: any) => a.categorie))].filter(Boolean) as string[];
  }

  private openPendingEdit(): void {
    if (!this.pendingEditId) return;
    const target = this.articles.find((a: any) => a.id === this.pendingEditId);
    this.pendingEditId = null;
    this.router.navigate([], { queryParams: {}, replaceUrl: true });
    if (target) this.openEditDialog(target);
  }

  onSearch(): void {
    const term = this.searchTerm.toLowerCase();
    this.filteredArticles = this.articles.filter((a: any) => {
      const matchSearch = a.nom?.toLowerCase().includes(term)
        || a.categorie?.toLowerCase().includes(term)
        || a.description?.toLowerCase().includes(term);
      const matchCat = this.selectedCategory === 'all' || a.categorie === this.selectedCategory;
      return matchSearch && matchCat;
    });
  }

  onCategoryChange(): void { this.onSearch(); }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedCategory = 'all';
    this.filteredArticles = this.articles;
  }

  openAddDialog(): void {
    this.dialog.open(ArticleDialogComponent, {
      width: '600px',
      data: { article: null, isEditMode: false }
    }).afterClosed().subscribe((result: any) => {
      if (result) {
        this.loadArticles();
        this.toast.success('Article créé avec succès !');
      }
    });
  }

  openEditDialog(article: any): void {
    this.dialog.open(ArticleDialogComponent, {
      width: '600px',
      data: { article: { ...article }, isEditMode: true }
    }).afterClosed().subscribe((result: any) => {
      if (result) {
        this.loadArticles();
        this.toast.success('Article modifié avec succès !');
      }
    });
  }

  confirmDelete(article: any): void {
    this.articleToDelete = article;
    this.showDeleteModal = true;
  }

  cancelDelete(): void {
    this.articleToDelete = null;
    this.showDeleteModal = false;
  }

  confirmDeleteAction(): void {
    if (!this.articleToDelete) return;
    const id = this.articleToDelete.id;
    this.api.deleteArticle(id).subscribe({
      next: () => { this.toast.success('Article supprimé'); this.loadArticles(); this.cancelDelete(); },
      error: (err: any) => this.toast.error(`Échec: ${err.error?.message || err.message || 'Erreur'}`)
    });
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', minimumFractionDigits: 0 }).format(price || 0);
  }

  getStockClass(stock: number): string {
    if (!stock) return 'stock-out';
    if (stock < 10) return 'stock-low';
    return 'stock-ok';
  }

  getStockIcon(stock: number): string {
    if (!stock) return 'error';
    if (stock < 10) return 'warning';
    return 'check_circle';
  }

  getLowStockCount(): number { return this.articles.filter((a: any) => (a.stock || 0) < 10).length; }

  daysUntilExpiry(dateStr: string | null | undefined): number | null {
    if (!dateStr) return null;
    const exp = new Date(dateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.round((exp.getTime() - now.getTime()) / 86400000);
  }

  getExpiryClass(dateStr: string | null | undefined): string {
    const d = this.daysUntilExpiry(dateStr);
    if (d === null) return '';
    if (d < 0) return 'expired';
    if (d <= 14) return 'expiring';
    return 'ok';
  }

  getTotalValue(): number {
    return this.articles.reduce((sum: number, a: any) => sum + ((a.prix || 0) * (a.stock || 0)), 0);
  }

  exportToCSV(): void {
    const headers = ['Nom', 'Catégorie', 'Description', 'Prix', 'Stock', 'Péremption'];
    const rows = this.filteredArticles.map((a: any) => [
      a.nom || '', a.categorie || '', a.description || '',
      (a.prix || 0).toString(), (a.stock || 0).toString(), a.expiration_date || ''
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `articles_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    this.toast.success('Export CSV réussi');
  }
}