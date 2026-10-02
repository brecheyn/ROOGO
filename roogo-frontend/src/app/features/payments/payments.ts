import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { ApiService } from '../../core/services/api.service';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatTabsModule],
  templateUrl: './payments.html',
  styleUrls: ['./payments.scss'],
})
export class PaymentsComponent implements OnInit {
  rates = signal<any>(null);
  conversionResult = signal<any>(null);
  paymentHistory = signal<any[]>([]);
  isLoading = signal(true);
  activeTab = 0;

  convertForm = { amount: 0, from: 'XOF', to: 'EUR' };
  payForm = { amount: 0, provider: 'orange_money', phone: '', description: '' };
  currencies = ['XOF', 'EUR', 'USD', 'GBP', 'GHS', 'NGN', 'CDF', 'KES'];
  providers = [
    { value: 'orange_money', label: 'Orange Money', icon: 'phone_android' },
    { value: 'mtn_mobile_money', label: 'MTN Mobile Money', icon: 'phone_android' },
    { value: 'wave', label: 'Wave', icon: 'waves' },
    { value: 'moov_money', label: 'Moov Money', icon: 'phone_android' },
  ];

  constructor(private api: ApiService, private notify: NotificationService) {}

  ngOnInit() {
    this.api.getExchangeRates().subscribe({ next: (d: any) => this.rates.set(d), error: () => {} });
    this.api.getPaymentHistory().subscribe({ next: (d: any) => { this.paymentHistory.set(d); this.isLoading.set(false); }, error: () => this.isLoading.set(false) });
  }

  doConvert() {
    if (!this.convertForm.amount) return;
    this.api.convertCurrency(this.convertForm.amount, this.convertForm.from, this.convertForm.to).subscribe({
      next: (d: any) => this.conversionResult.set(d?.data),
      error: () => this.notify.error('Erreur conversion'),
    });
  }

  doPay() {
    if (!this.payForm.amount || !this.payForm.phone) { this.notify.error('Montant et téléphone requis'); return; }
    this.api.initiatePayment(this.payForm).subscribe({
      next: (_d: any) => { this.notify.success('Paiement initié'); this.conversionResult.set(null); },
      error: (e: any) => this.notify.error(e?.error?.message || 'Erreur paiement'),
    });
  }
}
