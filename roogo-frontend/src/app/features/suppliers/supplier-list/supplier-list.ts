import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-supplier-list',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './supplier-list.html',
  styleUrls: ['./supplier-list.scss'],
})
export class SupplierListComponent implements OnInit {
  suppliers: any[] = [];
  filtered: any[] = [];
  loading = false;
  searchTerm = '';
  selectedSupplier: any = null;
  supplierToDelete: any = null;

  private apiUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void { this.loadSuppliers(); }

  private headers(): HttpHeaders {
    return new HttpHeaders({ Authorization: `Bearer ${localStorage.getItem('token')}` });
  }

  loadSuppliers(): void {
    this.loading = true;
    this.http.get<any>(`${this.apiUrl}/suppliers`, { headers: this.headers() })
      .subscribe({
        next: (res) => { this.suppliers = res.data || []; this.applyFilter(); this.loading = false; },
        error: () => { this.loading = false; }
      });
  }

  applyFilter(): void {
    const q = this.searchTerm.toLowerCase();
    this.filtered = q
      ? this.suppliers.filter(s =>
          s.name?.toLowerCase().includes(q) ||
          s.surname?.toLowerCase().includes(q) ||
          s.phone?.toLowerCase().includes(q))
      : [...this.suppliers];
  }

  resetFilter(): void { this.searchTerm = ''; this.applyFilter(); }

  viewSupplier(s: any): void { this.selectedSupplier = s; }
  closeDetail(): void { this.selectedSupplier = null; }

  editSupplier(s: any): void { this.router.navigate(['/suppliers', s.id, 'edit']); }
  createSupplier(): void { this.router.navigate(['/suppliers/new']); }

  confirmDelete(s: any): void { this.supplierToDelete = s; }
  cancelDelete(): void { this.supplierToDelete = null; }

  deleteSupplier(): void {
    if (!this.supplierToDelete) return;
    this.http.delete(`${this.apiUrl}/suppliers/${this.supplierToDelete.id}`, { headers: this.headers() })
      .subscribe({
        next: () => {
          this.suppliers = this.suppliers.filter(s => s.id !== this.supplierToDelete.id);
          this.applyFilter();
          if (this.selectedSupplier?.id === this.supplierToDelete.id) this.selectedSupplier = null;
          this.supplierToDelete = null;
        },
        error: (err) => console.error(err)
      });
  }

  getInitials(s: any): string {
    return ((s.name?.[0] || '') + (s.surname?.[0] || '')).toUpperCase() || '?';
  }
}