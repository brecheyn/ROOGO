import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { AssetsService } from '../../../core/services/assets.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule, RouterModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatIconModule, MatCheckboxModule, MatProgressSpinnerModule, MatCardModule
  ],
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class LoginComponent {

  loginForm: FormGroup;
  loading      = false;
  showPassword = false;
  errorMessage = '';
  private isBrowser: boolean;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    public assetsService: AssetsService,
    private authService: AuthService,
    private toast: ToastService,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);

    this.loginForm = this.fb.group({
      username:   ['', [Validators.required, Validators.minLength(3)]],
      password:   ['', [Validators.required]],
      rememberMe: [false]
    });

    if (this.isBrowser) {
      const remembered = localStorage.getItem('rememberedUser');
      if (remembered) {
        this.loginForm.patchValue({ username: remembered, rememberMe: true });
      }
    }
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    if (this.loginForm.invalid) return;

    this.loading      = true;
    this.errorMessage = '';

    const { username, password, rememberMe } = this.loginForm.value;

    this.authService.login({ username, password }).subscribe({
      next: () => {
        this.loading = false;

        if (this.isBrowser) {
          if (rememberMe) {
            localStorage.setItem('rememberedUser', username);
          } else {
            localStorage.removeItem('rememberedUser');
          }
        }

        this.toast.success('Connexion réussie ! Bienvenue sur ROOGO.');
        this.router.navigate(['/dashboard']);
      },
      error: (err: any) => {
        this.loading      = false;
        this.errorMessage = err?.error?.message || 'Identifiants incorrects. Veuillez réessayer.';
        this.toast.error(this.errorMessage);
      }
    });
  }
}