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
import { AuthService } from '/home/phares/Desktop/project/roogo/roogo-frontend/src/app/core/services/auth.service';
import { AssetsService } from '/home/phares/Desktop/project/roogo/roogo-frontend/src/app/core/services/assets.service';

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
  ],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.scss'],
})
export class SidebarComponent implements OnInit {

  organizationName = '';
  userName         = '';
  userRole         = '';
  sidenavOpened    = true;
  notifications: StockAlert[] = [];

  get notificationCount(): number {
    return this.notifications.length;
  }

  menuItems: MenuItem[] = [
    { icon: 'dashboard',            label: 'Tableau de bord', route: '/dashboard' },
    { icon: 'inventory_2',          label: 'Articles',        route: '/articles' },
    { icon: 'groups',               label: 'Clients',         route: '/clients' },
    { icon: 'local_shipping',       label: 'Fournisseurs',    route: '/suppliers' },
    { icon: 'point_of_sale',        label: 'Ventes',          route: '/sales' },
    { icon: 'shopping_basket',      label: 'Commandes',       route: '/orderings' },
    { icon: 'assessment',           label: 'Rapports',        route: '/reports' },
    { icon: 'admin_panel_settings', label: 'Administration',  route: '/admin', ownerOnly: true },
    { icon: 'settings',             label: 'Paramètres',      route: '/settings' },
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient,
    public assets: AssetsService   // public pour accès dans le template
  ) {}

  ngOnInit(): void {
    this.loadUserInfo();
    this.loadNotifications();
  }

  loadUserInfo(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.organizationName = (user as any).organizationName || '';
      this.userName         = user.username || 'Utilisateur';
      this.userRole         = this.getRoleLabel((user as any).role || '');
    }
  }

  loadNotifications(): void {
    this.http.get<StockAlert[]>('http://localhost:3000/api/dashboard/stock-alerts').pipe(
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

  logout(): void {
    this.authService.logout();
  }

  goToProfile(): void {
    this.router.navigate(['/profile']);
  }

  goToSettings(): void {
    this.router.navigate(['/settings']);
  }
}