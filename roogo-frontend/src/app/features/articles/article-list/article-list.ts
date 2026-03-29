import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { ApiService } from '../../../core/services/api.service';
import { ArticleDialogComponent } from '../article-form/article-form';
import { FilterByConditionPipe } from '../../../shared/pipes/filter.pipe';

@Component({
  selector: 'app-article-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatTableModule, MatButtonModule,
    MatInputModule, MatIconModule, MatDialogModule, MatSnackBarModule,
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
  displayedColumns = ['nom', 'categorie', 'description', 'prix', 'stock', 'actions'];
  isLoading = false;

  constructor(
    private api: ApiService,
    private snack: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void { this.loadArticles(); }

  loadArticles(): void {
    this.isLoading = true;
    this.api.getArticles().subscribe({
      next: (data: any[]) => {
        this.articles = data;
        this.filteredArticles = data;
        this.extractCategories();
        this.isLoading = false;
      },
      error: (err: any) => {
        console.error('Erreur chargement articles:', err);
        this.snack.open(`❌ ${err.message}`, 'Fermer', { duration: 4000 });
        this.isLoading = false;
      }
    });
  }

  extractCategories(): void {
    this.categories = [...new Set(this.articles.map((a: any) => a.categorie))].filter(Boolean) as string[];
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
      if (result) this.loadArticles();
    });
  }

  openEditDialog(article: any): void {
    this.dialog.open(ArticleDialogComponent, {
      width: '600px',
      data: { article: { ...article }, isEditMode: true }
    }).afterClosed().subscribe((result: any) => {
      if (result) this.loadArticles();
    });
  }

  deleteArticle(article: any): void {
    if (!confirm(`⚠️ Supprimer "${article.nom}" ?`)) return;
    this.api.deleteArticle(article.id).subscribe({
      next: () => { this.snack.open('🗑️ Supprimé', 'Fermer', { duration: 3000 }); this.loadArticles(); },
      error: (err: any) => this.snack.open(`❌ ${err.message}`, 'Fermer', { duration: 4000 })
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

  getTotalValue(): number {
    return this.articles.reduce((sum: number, a: any) => sum + ((a.prix || 0) * (a.stock || 0)), 0);
  }

  exportToCSV(): void {
    const headers = ['Nom', 'Catégorie', 'Description', 'Prix', 'Stock'];
    const rows = this.filteredArticles.map((a: any) => [
      a.nom || '', a.categorie || '', a.description || '',
      (a.prix || 0).toString(), (a.stock || 0).toString()
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `articles_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    this.snack.open('📥 Export CSV réussi', 'Fermer', { duration: 2000 });
  }
}