import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();

  // Cloner la requête et ajouter le token si disponible
  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(req).pipe(
    catchError(error => {
      if (error.status === 401) {
        // NE PAS déconnecter automatiquement - laisser le composant gérer l'erreur
        // Seulement rediriger si c'est une erreur d'auth réelle (pas un 401 transitoire)
        console.warn('API 401:', error.url);
        // On ne fait PAS logout() ici - on laisse le composant décider
      }
      return throwError(() => error);
    })
  );
};