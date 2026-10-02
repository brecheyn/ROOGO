import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './reports.html',
  styleUrls: ['./reports.scss'],
})
export class ReportsComponent implements OnInit {

  // ── State ──────────────────────────────────────────────────────────────────
  generatingAI = false;
  loadingReports = false;
  aiReport: any = null;
  reports: any[] = [];
  selectedReport: any = null;
  errorMsg = '';
  successMsg = '';

  reportToDelete: any = null;
  showDeleteModal = false;

  private apiUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadReports();
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  // ── Charger tous les rapports ──────────────────────────────────────────────
  loadReports(): void {
    this.loadingReports = true;
    this.http.get<any>(`${this.apiUrl}/rapports`, { headers: this.getHeaders() })
      .subscribe({
        next: (res) => {
          this.reports = res.data || [];
          this.loadingReports = false;
        },
        error: () => { this.loadingReports = false; }
      });
  }

  // ── Générer un rapport IA ──────────────────────────────────────────────────
  generateAIReport(): void {
    this.generatingAI = true;
    this.aiReport = null;
    this.errorMsg = '';
    this.successMsg = '';

    this.http.post<any>(`${this.apiUrl}/rapports/generate`, {}, { headers: this.getHeaders() })
      .subscribe({
        next: (res) => {
          this.aiReport = res.data;
          this.generatingAI = false;
          this.successMsg = 'Rapport IA généré avec succès !';
          this.loadReports(); // Rafraîchir la liste
          setTimeout(() => this.successMsg = '', 3000);
        },
        error: (err) => {
          this.generatingAI = false;
          this.errorMsg = err?.error?.message || 'Erreur lors de la génération';
        }
      });
  }

  // ── Voir un rapport ────────────────────────────────────────────────────────
  viewReport(report: any): void {
    this.selectedReport = report;
  }

  closeReport(): void {
    this.selectedReport = null;
  }

  // ── Supprimer un rapport ───────────────────────────────────────────────────
  confirmDelete(report: any): void {
    this.reportToDelete = report;
    this.showDeleteModal = true;
  }

  cancelDelete(): void {
    this.reportToDelete = null;
    this.showDeleteModal = false;
  }

  confirmDeleteAction(): void {
    if (!this.reportToDelete) return;
    const id = this.reportToDelete.id;
    this.http.delete(`${this.apiUrl}/rapports/${id}`, { headers: this.getHeaders() })
      .subscribe({
        next: () => {
          this.reports = this.reports.filter(r => r.id !== id);
          if (this.selectedReport?.id === id) this.selectedReport = null;
          this.cancelDelete();
        },
        error: (err) => console.error('Erreur suppression:', err)
      });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  getPrevisionLines(text: string): string[] {
    if (!text) return [];
    return text.split('\n').filter(l => l.trim().length > 0);
  }

  getRecommandations(text: string): string[] {
    if (!text) return [];
    return text.split('\n')
      .filter(l => l.trim().startsWith('-'))
      .map(l => l.replace(/^-\s*/, '').trim());
  }

  getBestsellers(text: string): string[] {
    if (!text || text === 'Aucune vente récente') return [];
    return text.split(', ').filter(Boolean);
  }
}