import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-supplier-form',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './supplier-form.html',
  styleUrls: ['./supplier-form.scss'],
})
export class SupplierFormComponent implements OnInit {
  isEdit = false;
  supplierId: number | null = null;
  loading = false;
  saving = false;
  successMsg = '';
  errorMsg = '';
  errors: any = {};

  form = { name: '', surname: '', phone: '', address: '' };

  private apiUrl = 'http://localhost:3000/api';

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isEdit = true;
      this.supplierId = +id;
      this.loadSupplier();
    }
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('token')}` });
  }

  loadSupplier(): void {
    this.loading = true;
    this.http.get<any>(`${this.apiUrl}/suppliers/${this.supplierId}`, { headers: this.headers() })
      .subscribe({
        next: (res) => {
          const d = res.data;
          this.form = { name: d.name || '', surname: d.surname || '', phone: d.phone || '', address: d.address || '' };
          this.loading = false;
        },
        error: () => { this.loading = false; this.errorMsg = 'Fournisseur introuvable'; }
      });
  }

  validate(): boolean {
    this.errors = {};
    if (!this.form.name.trim()) this.errors.name = 'Le nom est obligatoire';
    return Object.keys(this.errors).length === 0;
  }

  save(): void {
    this.errorMsg = ''; this.successMsg = '';
    if (!this.validate()) return;
    this.saving = true;

    const req = this.isEdit
      ? this.http.put<any>(`${this.apiUrl}/suppliers/${this.supplierId}`, this.form, { headers: this.headers() })
      : this.http.post<any>(`${this.apiUrl}/suppliers`, this.form, { headers: this.headers() });

    req.subscribe({
      next: () => {
        this.saving = false;
        this.successMsg = this.isEdit ? 'Fournisseur modifié !' : 'Fournisseur créé !';
        setTimeout(() => this.router.navigate(['/suppliers']), 1200);
      },
      error: (err) => {
        this.saving = false;
        this.errorMsg = err?.error?.message || 'Erreur lors de l\'enregistrement';
      }
    });
  }

  cancel(): void { this.router.navigate(['/suppliers']); }
}