import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { AssetsService } from '../../../core/services/assets.service';
import { StoreService } from '../../../core/services/store.service';
import { ChatbotComponent } from '../chatbot/chatbot';
import { ToastService } from '../../../core/services/toast.service';

import { resolveApiBase } from '../../../core/api-base';

interface MenuItem {
  icon:       string;
  label:      string;
  route:      string;
  badge?:     number;
  ownerOnly?: boolean;
}

interface StockAlert {
  nom:   string;
  stock: number;
  type:  'bas' | 'expire';
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    RouterOutlet,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatBadgeModule,
    MatMenuModule,
    MatDividerModule,
    MatTooltipModule,
    ChatbotComponent,
  ],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.scss'],
})
export class SidebarComponent implements OnInit {

  userName         = '';
  userRole         = '';
  sidenavOpened    = true;
  notifications: StockAlert[] = [];
  showLogoutConfirm = false;

  get notificationCount(): number {
    return this.notifications.length;
  }

  menuItems: MenuItem[] = [
    { icon: 'dashboard',            label: 'Tableau de bord',   route: '/dashboard' },
    { icon: 'inventory_2',          label: 'Articles',          route: '/articles' },
    { icon: 'groups',               label: 'Clients',           route: '/clients' },
    { icon: 'local_shipping',       label: 'Fournisseurs',      route: '/suppliers' },
    { icon: 'point_of_sale',        label: 'Ventes',            route: '/sales' },
    { icon: 'shopping_basket',      label: 'Commandes',         route: '/orderings' },
    { icon: 'store',                label: 'Magasins',          route: '/stores' },
    { icon: 'account_balance',      label: 'Finance',           route: '/finance' },
    { icon: 'smart_toy',            label: 'Recommandations',   route: '/intelligence/recommendations' },
    { icon: 'assessment',           label: 'Rapports',          route: '/reports' },
    { icon: 'admin_panel_settings', label: 'Administration',    route: '/admin', ownerOnly: true },
    { icon: 'settings',             label: 'Paramètres',        route: '/settings' },
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient,
    public assets: AssetsService,
    public storeService: StoreService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadUserInfo();
    this.loadNotifications();
  }

  loadUserInfo(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.userName = user.username || 'Utilisateur';
      this.userRole = this.getRoleLabel((user as any).role || '');
    }
  }

  loadNotifications(): void {
    this.http.get<StockAlert[]>(resolveApiBase() + '/dashboard/stock-alerts').pipe(
      catchError(() => of([]))
    ).subscribe(alerts => {
      this.notifications = alerts;
      const ventesItem = this.menuItems.find(m => m.route === '/sales');
      if (ventesItem) ventesItem.badge = alerts.length;
    });
  }

  getRoleLabel(role: string): string {
    const roles: { [key: string]: string } = {
      superadmin: 'Super Admin',
      OWNER:      'Propriétaire',
      MANAGER:    'Gestionnaire',
      VENDEUR:    'Vendeur',
    };
    return roles[role] || '';
  }

  isOwner(): boolean {
    const user = this.authService.getCurrentUser();
    return (user as any)?.role === 'OWNER'
      || (user as any)?.role === 'superadmin'
      || (user as any)?.isCreator === true;
  }

  shouldShowMenuItem(item: MenuItem): boolean {
    return item.ownerOnly ? this.isOwner() : true;
  }

  toggleSidenav(): void {
    this.sidenavOpened = !this.sidenavOpened;
  }

  async logout(): Promise<void> {
    this.showLogoutConfirm = true;
  }

  confirmLogout(): void {
    this.authService.logout();
    this.showLogoutConfirm = false;
    this.toast.info('Vous avez été déconnecté.');
  }

  cancelLogout(): void {
    this.showLogoutConfirm = false;
  }

  goToProfile(): void {
    this.router.navigate(['/settings']);
  }

  goToSettings(): void {
    this.router.navigate(['/settings']);
  }
}
