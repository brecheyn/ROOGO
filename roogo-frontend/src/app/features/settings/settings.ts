import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { StoreService } from '../../core/services/store.service';

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
  organization = { name: '', industry: 'retail', size: '1-10',
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
  profilePhoto: string | null = null;
  showPhotoViewer = false;
  showCurrentPw = false;
  showNewPw = false;
  showConfirmPw = false;
  private apiUrl = 'http://localhost:3000/api';

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private notificationService: NotificationService,
    private storeService: StoreService
  ) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      if (user) {
        this.currentUser  = user;
        this.profile.username = user.username;
        this.profile.email    = user.email;
        this.profile.phone    = (user as any).phone || '';
        this.profile.role     = user.role || 'Utilisateur';
      }
    });
    this.profilePhoto = localStorage.getItem('profile_photo');
    this.loadOrganization();
  }

  loadOrganization(): void {
    this.http.get<any>(`${this.apiUrl}/organizations`, { headers: this.getHeaders() })
      .subscribe({
        next: (res) => {
          if (res.success && res.data?.organization) {
            const org = res.data.organization;
            this.organization.name    = org.name || '';
            this.organization.address = org.address || '';
            this.organization.city    = org.city || 'Ouagadougou';
            this.organization.country = org.country || 'Burkina Faso';
          }
        },
        error: () => {}
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
      const file = input.files[0];
      if (!file.type.startsWith('image/')) {
        this.notificationService.error('Veuillez sélectionner une image');
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        this.notificationService.error('Image trop volumineuse (max 2 Mo)');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        this.profilePhoto = reader.result as string;
        this.selectedFile = file;
        this.storeService.setProfilePhoto(this.profilePhoto);
        this.notificationService.success('Photo sélectionnée');
      };
      reader.readAsDataURL(file);
      input.value = '';
    }
  }

  removePhoto(): void {
    this.profilePhoto = null;
    this.selectedFile = null;
    this.storeService.setProfilePhoto(null);
    this.notificationService.success('Photo supprimée');
  }

  saveProfile(): void {
    if (this.profilePhoto) {
      this.storeService.setProfilePhoto(this.profilePhoto);
    }

    const payload: any = {
      username: this.profile.username,
      email: this.profile.email,
      phone: this.profile.phone || '',
    };

    // Si un changement de mot de passe est en cours
    if (this.security.newPassword) {
      if (this.security.newPassword !== this.security.confirmPassword) {
        this.notificationService.error('Les mots de passe ne correspondent pas');
        return;
      }
      payload.currentPassword = this.security.currentPassword;
      payload.newPassword = this.security.newPassword;
    }

    this.http.put<any>(`${this.apiUrl}/auth/profile`, payload, { headers: this.getHeaders() })
      .subscribe({
        next: (res) => {
          if (res.success && res.user) {
            // Mettre à jour le localStorage
            const stored = localStorage.getItem('user');
            if (stored) {
              const u = JSON.parse(stored);
              Object.assign(u, res.user);
              localStorage.setItem('user', JSON.stringify(u));
            }
            this.profile.username = res.user.username;
            this.profile.email = res.user.email;
            this.profile.phone = res.user.phone || '';
          }
          // Reset password fields
          this.security.currentPassword = '';
          this.security.newPassword = '';
          this.security.confirmPassword = '';
          this.notificationService.success('Profil enregistré avec succès');
        },
        error: (err) => {
          this.notificationService.error(err?.error?.message || 'Erreur lors de l\'enregistrement');
        }
      });
  }
  saveOrganization(): void {
    const payload = {
      name: this.organization.name,
      address: this.organization.address,
      contact_email: this.profile.email,
      contact_phone: this.profile.phone,
    };
    this.http.put<any>(`${this.apiUrl}/organizations`, payload, { headers: this.getHeaders() })
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.storeService.setOrgName(res.data?.name || this.organization.name);
            this.notificationService.success('Organisation mise à jour');
          }
        },
        error: (err) => {
          this.notificationService.error(err?.error?.message || 'Erreur lors de la mise à jour');
        }
      });
  }
  saveNotifications(): void { this.notificationService.success('Notifications enregistrées'); }
  savePreferences(): void   { this.notificationService.success('Préférences enregistrées'); }

  updatePassword(): void {
    if (this.security.newPassword !== this.security.confirmPassword) {
      this.notificationService.error('Les mots de passe ne correspondent pas');
      return;
    }
    if (!this.security.currentPassword) {
      this.notificationService.error('Veuillez saisir votre mot de passe actuel');
      return;
    }
    if (this.security.newPassword.length < 6) {
      this.notificationService.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    const payload = {
      currentPassword: this.security.currentPassword,
      newPassword: this.security.newPassword,
      username: this.profile.username,
      email: this.profile.email,
    };

    this.http.put<any>(`${this.apiUrl}/auth/profile`, payload, { headers: this.getHeaders() })
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.notificationService.success('Mot de passe mis à jour');
            this.security.currentPassword = '';
            this.security.newPassword = '';
            this.security.confirmPassword = '';
          }
        },
        error: (err) => {
          this.notificationService.error(err?.error?.message || 'Erreur lors de la mise à jour');
        }
      });
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