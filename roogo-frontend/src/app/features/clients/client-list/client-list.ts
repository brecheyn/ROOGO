import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-client-list',
  standalone: true,
  imports: [CommonModule, FormsModule , MatIconModule],
  templateUrl: './client-list.html',
  styleUrls: ['./client-list.scss'],
})
export class ClientListComponent implements OnInit {

  clients: any[] = [];
  filteredClients: any[] = [];
  loading = true;
  searchQuery = '';
  showDeleteModal = false;
  clientToDelete: any = null;

  private apiUrl = 'http://localhost:3000/api';

  constructor(private router: Router, private http: HttpClient, private toast: ToastService) {}

  ngOnInit(): void {
    this.loadClients();
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  loadClients(): void {
    this.loading = true;
    this.http.get<any>(`${this.apiUrl}/clients`, { headers: this.getHeaders() })
      .subscribe({
        next: (res) => {
          this.clients = res.data || [];
          this.filteredClients = [...this.clients];
          this.loading = false;
        },
        error: (err) => { this.loading = false; this.toast.error(`Échec chargement: ${err.error?.message || err.message || 'Erreur'}`); }
      });
  }

  onSearch(): void {
    const q = this.searchQuery.toLowerCase().trim();
    this.filteredClients = q
      ? this.clients.filter(c =>
          `${c.name} ${c.surname}`.toLowerCase().includes(q) ||
          (c.phone || '').includes(q) ||
          (c.address || '').toLowerCase().includes(q)
        )
      : [...this.clients];
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.filteredClients = [...this.clients];
  }

  goToCreate(): void   { this.router.navigate(['/clients/new']); }
  goToDetail(id: number): void { this.router.navigate(['/clients', id]); }
  goToEdit(id: number): void   { this.router.navigate(['/clients', id, 'edit']); }

  confirmDelete(client: any): void {
    this.clientToDelete = client;
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.clientToDelete = null;
  }

  confirmDeleteAction(): void {
    if (!this.clientToDelete) return;
    const id = this.clientToDelete.id;
    this.http.delete(`${this.apiUrl}/clients/${id}`, { headers: this.getHeaders() })
      .subscribe({
        next: () => {
          this.clients = this.clients.filter(c => c.id !== id);
          this.filteredClients = this.filteredClients.filter(c => c.id !== id);
          this.toast.success('Client supprimé');
          this.closeDeleteModal();
        },
        error: (err) => this.toast.error(`Échec suppression: ${err.error?.message || err.message || 'Erreur'}`)
      });
  }

  cancelDelete(): void {
    this.closeDeleteModal();
  }
}