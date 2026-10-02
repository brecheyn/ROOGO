import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './client-detail.html',
  styleUrls: ['./client-detail.scss'],
})
export class ClientDetailComponent implements OnInit {

  client: any = null;
  sales: any[] = [];
  loading = true;
  showEditModal = false;

  editForm = {
    name: '',
    surname: '',
    phone: '',
    address: ''
  };

  private apiUrl = 'http://localhost:3000/api';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.loadClient(id);
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  loadClient(id: string): void {
    this.loading = true;
    this.http.get<any>(`${this.apiUrl}/clients/${id}`, { headers: this.getHeaders() })
      .subscribe({
        next: (res) => {
          this.client = res.data;
          this.editForm = {
            name:    this.client.name,
            surname: this.client.surname,
            phone:   this.client.phone,
            address: this.client.address
          };
          this.loadSales(id);
        },
        error: () => {
          this.loading = false;
          this.router.navigate(['/clients']);
        }
      });
  }

  loadSales(clientId: string): void {
    this.http.get<any>(`${this.apiUrl}/sales?client_id=${clientId}`, { headers: this.getHeaders() })
      .subscribe({
        next: (res) => {
          this.sales = res.data || [];
          this.loading = false;
        },
        error: () => {
          this.sales = [];
          this.loading = false;
        }
      });
  }

  // ── Stats calculées ────────────────────────────────────────────────────────
  get totalVentes(): number {
    return this.sales.length;
  }

  get totalCA(): number {
    return this.sales.reduce((sum, s) => sum + (s.price || 0), 0);
  }

  get moyennePanier(): number {
    return this.totalVentes > 0 ? this.totalCA / this.totalVentes : 0;
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  goBack(): void {
    this.router.navigate(['/clients']);
  }

  openEditModal(): void {
    this.showEditModal = true;
  }

  closeModal(): void {
    this.showEditModal = false;
  }

  saveEdit(): void {
    this.http.put<any>(
      `${this.apiUrl}/clients/${this.client.id}`,
      this.editForm,
      { headers: this.getHeaders() }
    ).subscribe({
      next: (res) => {
        this.client = res.data;
        this.closeModal();
        this.toast.success('Client modifié avec succès');
      },
      error: (err) => this.toast.error(err?.error?.message || 'Erreur lors de la modification')
    });
  }

  confirmDelete(): void {
    if (confirm(`Supprimer le client ${this.client.name} ${this.client.surname} ?`)) {
      this.http.delete(`${this.apiUrl}/clients/${this.client.id}`, { headers: this.getHeaders() })
        .subscribe({
          next: () => this.router.navigate(['/clients']),
          error: (err) => this.toast.error(err?.error?.message || 'Erreur lors de la suppression')
        });
    }
  }
}