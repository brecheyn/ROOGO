import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-finance',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTabsModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './finance.html',
  styleUrls: ['./finance.scss'],
})
export class FinanceComponent implements OnInit {
  fifo = signal<any>(null);
  weightedAvg = signal<any>(null);
  holdingCost = signal<any>(null);
  summary = signal<any>(null);
  simulation = signal<any>(null);
  isLoading = signal(true);
  activeTab = 0;

  simScenario = 'reduce_safety_stock';
  simParams = { reduction_pct: 10, discount_pct: 20, expected_increase: 2, article_id: null };
  scenarios = [
    { value: 'reduce_safety_stock', label: 'Réduire stock de sécurité' },
    { value: 'promotion_impact', label: 'Impact promotion' },
    { value: 'discontinue_product', label: 'Arrêt de produit' },
  ];

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getFIFOValuation().subscribe({ next: (d) => this.fifo.set(d), error: () => {} });
    this.api.getWeightedAvgValuation().subscribe({ next: (d) => this.weightedAvg.set(d), error: () => {} });
    this.api.getHoldingCost().subscribe({ next: (d) => { this.holdingCost.set(d); this.isLoading.set(false); }, error: () => this.isLoading.set(false) });
    this.api.getFinancialSummary().subscribe({ next: (d) => this.summary.set(d), error: () => {} });
  }

  runSimulation() {
    this.api.simulateScenario(this.simScenario, this.simParams).subscribe({
      next: (d) => this.simulation.set(d),
      error: () => {},
    });
  }
}
