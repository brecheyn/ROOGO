import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth-guard';
import path from 'path';

export const routes: Routes = [
 
  // Landing Page (Page d'accueil publique)
  {
    path: '',
    loadComponent: () => import('./features/landing/landing').then(m => m.LandingComponent)
  },
  
  // Routes d'authentification (non protégées)
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login').then(m => m.LoginComponent)
  },
  {
    path: 'signup',
    loadComponent: () => import('./features/auth/signup/signup').then(m => m.SignupComponent)
  },
  
  // Routes protégées avec SIDEBAR
  {
    path: '',
    loadComponent: () => import('./shared/components/sidebar/sidebar').then(m => m.SidebarComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then(m => m.DashboardComponent)
      },
      {
        path: 'clients',
       children: [
    {
      path: '',
      loadComponent: () => import('./features/clients/client-list/client-list').then(m => m.ClientListComponent)
    },
    {
      path: 'new',
      loadComponent: () => import('./features/clients/client-form/client-form').then(m => m.ClientFormComponent)
    },
    {
      path: ':id',
      loadComponent: () => import('./features/clients/client-detail/client-detail').then(m => m.ClientDetailComponent)
    },
    {
      path: ':id/edit',
      loadComponent: () => import('./features/clients/client-form/client-form').then(m => m.ClientFormComponent)
    }
  ]
},
    {
      path: 'suppliers',
      children: [
        { path: '', loadComponent: () => import('./features/suppliers/supplier-list/supplier-list').then(m => m.SupplierListComponent) }, 
      
        {
          path:':id', 
          loadComponent: () => import('./features/suppliers/supplier-form/supplier-form').then(m => m.SupplierFormComponent)
        },
        {
          path: 'new',
          loadComponent: () => import('./features/suppliers/supplier-form/supplier-form').then(m => m.SupplierFormComponent)  
        },
        {
          path: ':id/edit',
          loadComponent: () => import('./features/suppliers/supplier-form/supplier-form').then(m => m.SupplierFormComponent)  
        }
      ]
    },
    { path: 'orderings', 
      children: [
       {path: '',loadComponent: () => import('./features/orderings/ordering-form/ordering-form').then(m => m.OrderingFormComponent) 
    },
    {
      path: ':id',
      loadComponent: () => import('./features/orderings/ordering-form/ordering-form').then(m => m.OrderingFormComponent)  
    },
    {
      path: 'new',
      loadComponent: () => import('./features/orderings/ordering-form/ordering-form').then(m => m.OrderingFormComponent)  
    },
    {
      path: ':id/edit',
      loadComponent: () => import('./features/orderings/ordering-form/ordering-form').then(m => m.OrderingFormComponent)
    }
  ]

    },

      {
        path: 'articles',
        loadComponent: () => import('./features/articles/article-list/article-list').then(m => m.ArticleListComponent)
      },
      {
        path: 'sales',
        children: [
          {
            path: '',
            loadComponent: () => import('./features/sales/sale-list/sale-list').then(m => m.SaleListComponent)
          },
          {
            path: 'new',
            loadComponent: () => import('./features/sales/sale-form/sale-form').then(m => m.SaleFormComponent)
          }
        ]
      },
      {
        path: 'reports',
        loadComponent: () => import('./features/reports/reports').then(m => m.ReportsComponent)
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings').then(m => m.SettingsComponent)
      },
      {
        path: 'categories',
        loadComponent: () => import('./features/categories/categories').then(m => m.CategoriesComponent)
      }
    ]
  },
  
  // Route fallback
  {
    path: '**',
    redirectTo: ''
  }
];