import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/services/auth.service';
import { AssetsService } from '../../../core/services/assets.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterModule,
    MatInputModule, MatButtonModule, MatFormFieldModule,
    MatSelectModule, MatIconModule, MatProgressSpinnerModule
  ],
  templateUrl: './signup.html',
  styleUrls: ['./signup.scss']
})
export class SignupComponent {

  currentStep  = 1;
  loading      = false;
  showPassword = false;
  errorMessage = '';
  errors: any  = {};

  // Tous les champs — envoyés au backend au submit
  formData = {
    username:         '',
    email:            '',
    password:         '',
    organizationName: '',
    industry:         '',
    phone:            '',
    plan:             'starter'
  };

  industries = [
    { label: 'Commerce général', value: 'retail',      icon: '' },
    { label: 'Restauration',     value: 'restaurant',  icon: '' },
    { label: 'Pharmacie',        value: 'pharmacy',    icon: '' },
    { label: 'Services',         value: 'services',    icon: '' },
    { label: 'Tech',             value: 'tech',        icon: '' },
    { label: 'Autre',            value: 'other',       icon: '' }
  ];

  plans = [
    {
      name:    'Starter',
      value:   'starter',
      popular: false,
      price:   'Gratuit',
      desc:    '50 ventes/mois · 100 articles · 1 utilisateur'
    },
    {
      name:    'Pro',
      value:   'pro',
      popular: true,
      price:   '15 000 FCFA/mois',
      desc:    'Ventes illimitées · 5 utilisateurs · Rapports IA'
    },
    {
      name:    'Enterprise',
      value:   'enterprise',
      popular: false,
      price:   'Sur mesure',
      desc:    'Utilisateurs illimités · API · Support 24/7'
    }
  ];

  constructor(
    private auth: AuthService,
    private router: Router,
    public assetsService: AssetsService
  ) {}

  // ── Navigation entre étapes ────────────────────────────────────────────────
  goToStep(step: number): void {
    this.errors = {};
    this.errorMessage = '';
    if (step === 2 && !this.validateStep1()) return;
    if (step === 3 && !this.validateStep2()) return;
    this.currentStep = step;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Validation step 1 ─────────────────────────────────────────────────────
  validateStep1(): boolean {
    this.errors = {};
    if (!this.formData.username || this.formData.username.length < 3)
      this.errors.username = 'Minimum 3 caractères';
    if (!this.formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.formData.email))
      this.errors.email = 'Email invalide';
    if (!this.formData.password || this.formData.password.length < 8)
      this.errors.password = 'Minimum 8 caractères';
    return Object.keys(this.errors).length === 0;
  }

  // ── Validation step 2 ─────────────────────────────────────────────────────
  validateStep2(): boolean {
    this.errors = {};
    if (!this.formData.organizationName.trim())
      this.errors.organizationName = 'Champ requis';
    if (!this.formData.industry)
      this.errors.industry = 'Veuillez choisir un secteur';
    return Object.keys(this.errors).length === 0;
  }

  // ── Force du mot de passe ─────────────────────────────────────────────────
  get passwordStrength(): number {
    const pwd = this.formData.password;
    let score = 0;
    if (pwd.length >= 8)          score++;
    if (/[A-Z]/.test(pwd))        score++;
    if (/[0-9]/.test(pwd))        score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    return Math.min(score, 3);
  }

  get passwordStrengthLabel(): string {
    return ['', 'Faible', 'Moyen', 'Fort'][this.passwordStrength];
  }

  // ── Soumission — envoie TOUS les champs au backend ────────────────────────
  onSubmit(): void {
    this.loading      = true;
    this.errorMessage = '';

    // Le backend reçoit : username, email, password, organizationName,
    //                     industry, phone, plan
    this.auth.signup(this.formData).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err: any) => {
        this.loading      = false;
        this.errorMessage = err?.error?.message || 'Erreur lors de la création du compte.';
      }
    });
  }
}