import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { resolveApiBase } from '../api-base';

@Injectable({ providedIn: 'root' })
export class StoreService {
  private stores = signal<any[]>([]);
  private selectedStoreId = signal<number | null>(null);
  private orgNameSignal = signal<string>('');
  private profilePhotoSignal = signal<string | null>(null);
  private apiUrl = resolveApiBase();

  readonly storeList = this.stores.asReadonly();
  readonly currentStoreId = this.selectedStoreId.asReadonly();
  readonly organizationName = this.orgNameSignal.asReadonly();
  readonly profilePhoto = this.profilePhotoSignal.asReadonly();

  readonly currentStore = computed(() => {
    const id = this.selectedStoreId();
    if (!id) return null;
    return this.stores().find((s: any) => s.id === id) || null;
  });

  readonly currentStoreName = computed(() => {
    return this.currentStore()?.name || 'Tous les magasins';
  });

  constructor(private http: HttpClient) {
    this.loadStores();
    this.loadOrgName();
    this.profilePhotoSignal.set(localStorage.getItem('profile_photo'));
  }

  setProfilePhoto(photo: string | null): void {
    this.profilePhotoSignal.set(photo);
    if (photo) {
      localStorage.setItem('profile_photo', photo);
    } else {
      localStorage.removeItem('profile_photo');
    }
  }

  loadStores() {
    const token = localStorage.getItem('token');
    this.http.get<any[]>(`${this.apiUrl}/stores`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    }).subscribe({
      next: (data: any) => {
        this.stores.set(data || []);
        const saved = localStorage.getItem('selectedStoreId');
        if (saved) {
          const id = parseInt(saved, 10);
          if (this.stores().some((s: any) => s.id === id)) {
            this.selectedStoreId.set(id);
          } else {
            this.selectedStoreId.set(null);
            localStorage.removeItem('selectedStoreId');
          }
        }
      },
      error: () => {}
    });
  }

  loadOrgName(): void {
    const token = localStorage.getItem('token');
    if (!token) return;
    this.http.get<any>(`${this.apiUrl}/organizations`, {
      headers: { Authorization: `Bearer ${token}` }
    }).subscribe({
      next: (res: any) => {
        const name = res?.data?.organization?.name || '';
        if (name) {
          this.orgNameSignal.set(name);
          localStorage.setItem('orgName', name);
        }
      },
      error: () => {
        const stored = localStorage.getItem('orgName');
        if (stored) this.orgNameSignal.set(stored);
      }
    });
  }

  setOrgName(name: string): void {
    this.orgNameSignal.set(name);
    localStorage.setItem('orgName', name);
  }

  refreshStores(): void {
    this.loadStores();
  }

  selectStore(id: number | null) {
    this.selectedStoreId.set(id);
    if (id) {
      localStorage.setItem('selectedStoreId', id.toString());
    } else {
      localStorage.removeItem('selectedStoreId');
    }
  }
}
