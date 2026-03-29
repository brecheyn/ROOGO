import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';

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

  constructor(private router: Router, private http: HttpClient) {}

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
        error: () => { this.loading = false; }
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

  deleteClient(): void {
    if (!this.clientToDelete) return;
    this.http.delete(`${this.apiUrl}/clients/${this.clientToDelete.id}`, { headers: this.getHeaders() })
      .subscribe({
        next: () => {
          this.clients = this.clients.filter(c => c.id !== this.clientToDelete.id);
          this.filteredClients = this.filteredClients.filter(c => c.id !== this.clientToDelete.id);
          this.closeDeleteModal();
        },
        error: (err) => console.error('Erreur suppression:', err)
      });
  }
}