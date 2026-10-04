import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

import { resolveApiBase } from '../../../core/api-base';

@Component({
  selector: 'app-ordering-form',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './ordering-form.html',
  styleUrls: ['./ordering-form.scss'],
})
export class OrderingFormComponent implements OnInit {
  saving = false;
  successMsg = '';
  errorMsg = '';
  errors: any = {};

  form = { id_article: null as number | null, id_supplier: null as number | null, quantity: null as number | null, price: null as number | null };

  articles: any[] = [];
  suppliers: any[] = [];

  private apiUrl = resolveApiBase();

  constructor(private http: HttpClient, private router: Router, private route: ActivatedRoute) {}

  ngOnInit(): void {
    const articleId = Number(this.route.snapshot.queryParamMap.get('id_article'));
    if (articleId) this.form.id_article = articleId;
    this.loadArticles();
    this.loadSuppliers();
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('token')}` });
  }

  loadArticles(): void {
    this.http.get<any>(`${this.apiUrl}/articles`, { headers: this.headers() })
      .subscribe({ next: (res) => { this.articles = res.data || []; } });
  }

  loadSuppliers(): void {
    this.http.get<any>(`${this.apiUrl}/suppliers`, { headers: this.headers() })
      .subscribe({ next: (res) => { this.suppliers = res.data || []; } });
  }

  get selectedArticle(): any {
    return this.articles.find(a => a.id === this.form.id_article);
  }

  get selectedSupplier(): any {
    return this.suppliers.find(s => s.id === this.form.id_supplier);
  }

  validate(): boolean {
    this.errors = {};
    if (!this.form.id_article)  this.errors.id_article  = 'Sélectionnez un article';
    if (!this.form.id_supplier) this.errors.id_supplier = 'Sélectionnez un fournisseur';
    if (!this.form.quantity || this.form.quantity < 1) this.errors.quantity = 'Quantité invalide';
    if (!this.form.price    || this.form.price < 0)   this.errors.price    = 'Prix invalide';
    return Object.keys(this.errors).length === 0;
  }

  save(): void {
    this.errorMsg = ''; this.successMsg = '';
    if (!this.validate()) return;
    this.saving = true;

    const payload = {
      id_article: Number(this.form.id_article),
      id_supplier: Number(this.form.id_supplier),
      quantity: Number(this.form.quantity),
      price: Number(this.form.price),
    };

    this.http.post<any>(`${this.apiUrl}/orderings`, payload, { headers: this.headers() })
      .subscribe({
        next: () => {
          this.saving = false;
          this.successMsg = 'Commande passée avec succès !';
          setTimeout(() => this.router.navigate(['/orderings']), 1200);
        },
        error: (err) => {
          this.saving = false;
          this.errorMsg = err?.error?.message || 'Erreur lors de la création';
        }
      });
  }

  cancel(): void { this.router.navigate(['/orderings']); }
}
