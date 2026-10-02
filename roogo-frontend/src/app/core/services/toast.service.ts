import { Injectable, inject } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private snackBar = inject(MatSnackBar);

  private defaultConfig: MatSnackBarConfig = {
    duration: 4000,
    horizontalPosition: 'end',
    verticalPosition: 'top',
    panelClass: []
  };

  private show(message: string, type: ToastType, config?: Partial<MatSnackBarConfig>) {
    const panelClass = [`toast-${type}`, ...(config?.panelClass || [])];
    this.snackBar.open(message, 'Fermer', {
      ...this.defaultConfig,
      ...config,
      panelClass
    });
  }

  success(message: string, config?: Partial<MatSnackBarConfig>) {
    this.show(message, 'success', config);
  }

  error(message: string, config?: Partial<MatSnackBarConfig>) {
    this.show(message, 'error', { duration: 6000, ...config });
  }

  warning(message: string, config?: Partial<MatSnackBarConfig>) {
    this.show(message, 'warning', config);
  }

  info(message: string, config?: Partial<MatSnackBarConfig>) {
    this.show(message, 'info', config);
  }

  confirm(message: string, action: string = 'Confirmer'): Promise<boolean> {
    return new Promise((resolve) => {
      const ref = this.snackBar.open(message, action, {
        ...this.defaultConfig,
        duration: 0,
        panelClass: ['toast-confirm']
      });
      let resolved = false;
      ref.onAction().subscribe(() => {
        if (!resolved) { resolved = true; resolve(true); }
      });
      ref.afterDismissed().subscribe(() => {
        if (!resolved) { resolved = true; resolve(false); }
      });
    });
  }
}