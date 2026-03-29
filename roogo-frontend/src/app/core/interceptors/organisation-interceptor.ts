import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { Observable } from 'rxjs';

export const organizationInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<any> => {
  // Récupérer ton organizationSlug depuis localStorage ou une valeur fixe
  const organizationSlug = localStorage.getItem('organizationSlug') || 'test-org';

  const clonedReq = req.clone({
    setHeaders: {
      'X-Organization-Slug': organizationSlug,
      'Content-Type': 'application/json'
    }
  });

  console.log('Interceptor HTTP standalone actif, headers:', clonedReq.headers.keys());

  return next(clonedReq);
};
