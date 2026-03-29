import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-client-form',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './client-form.html',
  styleUrls: ['./client-form.scss'],
})
export class ClientFormComponent implements OnInit {

  isEditMode = false;
  loading = false;
  submitting = false;
  errorMsg = '';
  successMsg = '';
  clientId: string | null = null;

  form = {
    name: '',
    surname: '',
    phone: '',
    address: ''
  };

  errors: any = {};

  private apiUrl = 'http://localhost:3000/api';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.clientId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.clientId;

    if (this.isEditMode) {
      this.loadClient();
    }
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  loadClient(): void {
    this.loading = true;
    this.http.get<any>(`${this.apiUrl}/clients/${this.clientId}`, { headers: this.getHeaders() })
      .subscribe({
        next: (res) => {
          const c = res.data;
          this.form = {
            name:    c.name,
            surname: c.surname,
            phone:   c.phone || '',
            address: c.address || ''
          };
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.router.navigate(['/clients']);
        }
      });
  }

  validate(): boolean {
    this.errors = {};
    if (!this.form.name.trim())    this.errors.name    = 'Le nom est obligatoire';
    if (!this.form.surname.trim()) this.errors.surname = 'Le prénom est obligatoire';
    return Object.keys(this.errors).length === 0;
  }

  clearError(field: string): void {
    delete this.errors[field];
  }

  submit(): void {
    this.errorMsg = '';
    this.successMsg = '';

    if (!this.validate()) return;

    this.submitting = true;

    const request$ = this.isEditMode
      ? this.http.put<any>(`${this.apiUrl}/clients/${this.clientId}`, this.form, { headers: this.getHeaders() })
      : this.http.post<any>(`${this.apiUrl}/clients`, this.form, { headers: this.getHeaders() });

    request$.subscribe({
      next: (res) => {
        this.submitting = false;
        this.successMsg = this.isEditMode ? 'Client modifié avec succès !' : 'Client créé avec succès !';
        setTimeout(() => this.router.navigate(['/clients']), 1200);
      },
      error: (err) => {
        this.submitting = false;
        this.errorMsg = err?.error?.message || 'Une erreur est survenue';
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/clients']);
  }
}