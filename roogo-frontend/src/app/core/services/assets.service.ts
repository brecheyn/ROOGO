import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AssetsService {
  private basePath = 'assets';

  readonly images = {
    logo: `${this.basePath}/images/roogo.png`,
    logoDark: `${this.basePath}/images/roogo-dark.png`,
    hero: `${this.basePath}/images/hero-bg.png`,
    products: {
      placeholder: `${this.basePath}/images/products/placeholder.png`,
    },
  };

  readonly icons = {
    favicon: `${this.basePath}/icons/favicon.ico`,
  };

  getImagePath(filename: string): string {
    return `${this.basePath}/images/${filename}`;
  }
}
