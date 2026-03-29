import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { AssetsService } from '../../core/services/assets.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterModule, MatButtonModule, MatIconModule, MatCardModule],
  templateUrl: './landing.html',
  styleUrls: ['./landing.scss'],
})
export class LandingComponent {
  features = [
    {
      icon: 'inventory_2',
      title: 'Gestion de Stock',
      description: 'Suivez votre inventaire en temps réel et recevez des alertes automatiques',
    },
    {
      icon: 'point_of_sale',
      title: 'Ventes Rapides',
      description:
        'Enregistrez vos ventes en quelques clics et générez des factures instantanément',
    },
    {
      icon: 'analytics',
      title: 'Rapports IA',
      description: 'Analyses intelligentes et recommandations pour optimiser votre business',
    },
    {
      icon: 'groups',
      title: 'Multi-utilisateurs',
      description: 'Gérez plusieurs vendeurs et magasins depuis une seule plateforme',
    },
    {
      icon: 'cloud',
      title: '100% Cloud',
      description: "Accédez à vos données partout, n'importe quand, sur tous vos appareils",
    },
    {
      icon: 'security',
      title: 'Sécurisé',
      description: 'Vos données sont cryptées et sauvegardées automatiquement',
    },
  ];

  plans = [
    {
      name: 'Gratuit',
      price: '0',
      period: '',
      features: ['3 utilisateurs', '1 magasin', '100 MB stockage', 'Support email'],
      recommended: false,
    },
    {
      name: 'Pro',
      price: '25 000',
      period: '/mois',
      features: [
        '10 utilisateurs',
        '3 magasins',
        '1 GB stockage',
        'Rapports IA',
        'Export Excel/PDF',
        'Support prioritaire',
      ],
      recommended: true,
    },
    {
      name: 'Entreprise',
      price: '100 000',
      period: '/mois',
      features: [
        '50 utilisateurs',
        '10 magasins',
        '10 GB stockage',
        'API personnalisée',
        'Support 24/7',
        'Formation dédiée',
      ],
      recommended: false,
    },
  ];

  testimonials = [
    {
      name: 'Amadou Diallo',
      business: 'Boutique Électronique',
      comment: 'roogo a transformé ma gestion. Je gagne 3h par jour !',
      avatar: '👨🏿‍💼',
    },
    {
      name: 'Fatou Sow',
      business: 'Supermarché Central',
      comment: "Les rapports IA m'aident à prendre les bonnes décisions.",
      avatar: '👩🏿‍💼',
    },
    {
      name: 'Ousmane Ndiaye',
      business: 'Pharmacie du Quartier',
      comment: 'Simple, efficace et accessible partout. Je recommande !',
      avatar: '👨🏿‍⚕️',
    },
  ];

  constructor(
    private router: Router,
    public assetsService: AssetsService,
  ) {}

  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }

  goToSignup(): void {
    this.router.navigate(['/signup']);
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}
