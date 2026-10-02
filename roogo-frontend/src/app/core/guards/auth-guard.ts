import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  // En SSR, on autorise (le composant fera sa propre vérif côté client)
  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  // Côté client : vérification synchrone du token
  const token = localStorage.getItem('token');
  if (token) {
    return true;
  }

  // Rediriger vers la page de login avec l'URL de retour
  router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
  return false;
};