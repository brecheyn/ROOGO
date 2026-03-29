import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './settings.html',
  styleUrls: ['./settings.scss'],
})
export class SettingsComponent implements OnInit {

  activeTab = 'profile';
  currentUser: any = null;

  profile = { username: '', email: '', phone: '', role: '' };
  security = { currentPassword: '', newPassword: '', confirmPassword: '',
                twoFactorEnabled: false, loginNotifications: true };
  organization = { name: 'Ma Boutique SARL', industry: 'retail', size: '1-10',
                   address: '', city: 'Ouagadougou', country: 'Burkina Faso' };
  notifications: any = { newSales: true, lowStock: true, newClients: true,
                          weeklyReports: false, emailEnabled: true, pushEnabled: true };
  preferences: any = { language: 'fr', timezone: 'GMT', currency: 'XOF',
                        dateFormat: 'DD/MM/YYYY', darkMode: false, soundsEnabled: true };

  // ── Employés ────────────────────────────────────────────────────────────────
  employees: any[] = [];
  employeeCount = 0;
  loadingEmployees = false;
  creatingEmployee = false;
  empSuccessMsg = '';
  empErrorMsg = '';
  empErrors: any = {};

  newEmployee = { username: '', email: '', password: '' };

  // ── Options ─────────────────────────────────────────────────────────────────
  notificationItems = [
    { key: 'newSales',      label: 'Nouvelles ventes',         desc: 'Notifier à chaque vente' },
    { key: 'lowStock',      label: 'Stock faible',             desc: 'Alerte quand le stock est bas' },
    { key: 'newClients',    label: 'Nouveaux clients',         desc: 'Notifier à chaque nouveau client' },
    { key: 'weeklyReports', label: 'Rapports hebdomadaires',   desc: 'Résumé chaque semaine' },
    { key: 'emailEnabled',  label: 'Notifications par email',  desc: 'Recevoir par email' },
    { key: 'pushEnabled',   label: 'Notifications push',       desc: 'Notifications dans l\'app' },
  ];

  industries   = [{ label: 'Commerce de détail', value: 'retail' }, { label: 'Restauration', value: 'restaurant' },
                  { label: 'Services', value: 'services' }, { label: 'Technologie', value: 'tech' }];
  companySizes = [{ label: '1-10 employés', value: '1-10' }, { label: '11-50 employés', value: '11-50' },
                  { label: '51-200 employés', value: '51-200' }];
  languages    = [{ label: 'Français', value: 'fr' }, { label: 'English', value: 'en' }];
  timezones    = [{ label: 'GMT (Ouagadougou)', value: 'GMT' }, { label: 'GMT+1 (Paris)', value: 'GMT+1' }];
  currencies   = [{ label: 'XOF (Franc CFA)', value: 'XOF' }, { label: 'EUR (Euro)', value: 'EUR' }];
  dateFormats  = [{ label: 'DD/MM/YYYY', value: 'DD/MM/YYYY' }, { label: 'MM/DD/YYYY', value: 'MM/DD/YYYY' }];

  selectedFile: File | null = null;
  private apiUrl = 'http://localhost:3000/api';

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.currentUser  = user;
        this.profile.username = user.username;
        this.profile.email    = user.email;
        this.profile.role     = user.role || 'Utilisateur';
      }
    });
  }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  getUserInitials(): string {
    return this.profile.username?.charAt(0).toUpperCase() || '?';
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedFile = input.files[0];
      this.notificationService.success('Photo sélectionnée');
    }
  }

  saveProfile(): void       { this.notificationService.success('Profil enregistré'); }
  saveOrganization(): void  { this.notificationService.success('Organisation mise à jour'); }
  saveNotifications(): void { this.notificationService.success('Notifications enregistrées'); }
  savePreferences(): void   { this.notificationService.success('Préférences enregistrées'); }

  updatePassword(): void {
    if (this.security.newPassword !== this.security.confirmPassword) {
      this.notificationService.error('Les mots de passe ne correspondent pas');
      return;
    }
    this.notificationService.success('Mot de passe mis à jour');
    this.security.currentPassword = '';
    this.security.newPassword = '';
    this.security.confirmPassword = '';
  }

  // ── Gestion des employés ───────────────────────────────────────────────────
  loadEmployees(): void {
    this.loadingEmployees = true;
    this.http.get<any>(`${this.apiUrl}/users/employees/mine`, { headers: this.getHeaders() })
      .subscribe({
        next: (res) => {
          this.employees     = res.data || [];
          this.employeeCount = res.count || 0;
          this.loadingEmployees = false;
        },
        error: () => { this.loadingEmployees = false; }
      });
  }

  validateEmployee(): boolean {
    this.empErrors = {};
    if (!this.newEmployee.username.trim()) this.empErrors.username = 'Nom d\'utilisateur obligatoire';
    if (!this.newEmployee.password.trim()) this.empErrors.password = 'Mot de passe obligatoire';
    return Object.keys(this.empErrors).length === 0;
  }

  createEmployee(): void {
    this.empErrorMsg  = '';
    this.empSuccessMsg = '';
    if (!this.validateEmployee()) return;

    this.creatingEmployee = true;
    this.http.post<any>(`${this.apiUrl}/users/employees/create`, this.newEmployee, { headers: this.getHeaders() })
      .subscribe({
        next: (res) => {
          this.creatingEmployee = false;
          this.empSuccessMsg = `Compte "${res.data.username}" créé ! Il reste ${res.remaining} place(s).`;
          this.newEmployee = { username: '', email: '', password: '' };
          this.loadEmployees();
          setTimeout(() => this.empSuccessMsg = '', 4000);
        },
        error: (err) => {
          this.creatingEmployee = false;
          this.empErrorMsg = err?.error?.message || 'Erreur lors de la création';
        }
      });
  }
}