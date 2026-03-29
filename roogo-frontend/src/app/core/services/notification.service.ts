import { Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {

  constructor(private snackBar: MatSnackBar) {}

  success(message: string, detail?: string): void {
    const displayMessage = detail ? `${message}: ${detail}` : message;
    this.snackBar.open(displayMessage, 'Fermer', {
      duration: 3000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: ['snackbar-success']
    });
  }

  error(message: string, detail?: string): void {
    const displayMessage = detail ? `${message}: ${detail}` : message;
    this.snackBar.open(displayMessage, 'Fermer', {
      duration: 5000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: ['snackbar-error']
    });
  }

  info(message: string, detail?: string): void {
    const displayMessage = detail ? `${message}: ${detail}` : message;
    this.snackBar.open(displayMessage, 'Fermer', {
      duration: 3000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: ['snackbar-info']
    });
  }

  warn(message: string, detail?: string): void {
    const displayMessage = detail ? `${message}: ${detail}` : message;
    this.snackBar.open(displayMessage, 'Fermer', {
      duration: 4000,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass: ['snackbar-warning']
    });
  }

  clear(): void {
    this.snackBar.dismiss();
  }
}