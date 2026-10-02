import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-article-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatIconModule, MatSelectModule, MatProgressSpinnerModule, MatDialogModule,
  ],
  templateUrl: './article-form.html',
  styleUrls: ['./article-form.scss'],
})
export class ArticleDialogComponent implements OnInit {
  articleForm!: FormGroup;
  loading = false;

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<ArticleDialogComponent>,
    private artService: ApiService,
    private toast: ToastService,
    @Inject(MAT_DIALOG_DATA) public data: { isEditMode: boolean; article?: any },
  ) {}

  ngOnInit(): void {
    this.articleForm = this.fb.group({
      nom:                 ['', [Validators.required, Validators.minLength(3)]],
      categorie:           ['', Validators.required],
      categoriePersonnalisee: [''],
      description:         [''],
      prix:                [0, [Validators.required, Validators.min(0)]],
      stock:               [0, [Validators.required, Validators.min(0)]],
      expiration_date:     [''],
    });
    if (this.data.isEditMode && this.data.article) {
      this.articleForm.patchValue(this.data.article);
      // Normaliser la date pour l'input type="date" (yyyy-MM-dd)
      const exp = this.data.article.expiration_date;
      if (exp) {
        this.articleForm.get('expiration_date')?.setValue(String(exp).substring(0, 10));
      }
      // Si la catégorie n'est pas dans la liste prédéfinie, afficher le champ personnalisé
      const predefined = ['Alimentation', 'Électronique', 'Fournitures', 'Hygiène', 'Boissons', 'Textile', 'Informatique', 'Bureau', 'Mobilier'];
      if (this.data.article.categorie && !predefined.includes(this.data.article.categorie)) {
        this.showCustomCategory = true;
        this.articleForm.get('categoriePersonnalisee')?.setValue(this.data.article.categorie);
        this.articleForm.get('categoriePersonnalisee')?.setValidators([Validators.required, Validators.minLength(2)]);
        this.articleForm.get('categoriePersonnalisee')?.updateValueAndValidity();
      }
    }
  }

  showCustomCategory = false;

  onCategoryChange(event: any): void {
    const value = event.value;
    const customCtrl = this.articleForm.get('categoriePersonnalisee');
    if (value === 'Autre') {
      this.showCustomCategory = true;
      customCtrl?.setValidators([Validators.required, Validators.minLength(2)]);
    } else {
      this.showCustomCategory = false;
      customCtrl?.clearValidators();
      customCtrl?.setValue('');
    }
    customCtrl?.updateValueAndValidity();
  }

  getEffectiveCategory(): string {
    if (this.articleForm.get('categorie')?.value === 'Autre') {
      return this.articleForm.get('categoriePersonnalisee')?.value || '';
    }
    return this.articleForm.get('categorie')?.value || '';
  }

  formatPrice(value: number): string {
    return value?.toLocaleString('fr-FR', { style: 'currency', currency: 'XOF' });
  }

  onCancel(): void { this.dialogRef.close(); }

  onSubmit(): void {
    if (this.articleForm.invalid) return;
    this.loading = true;

    // Remplacer la catégorie par la valeur effective
    const payload = { ...this.articleForm.value, categorie: this.getEffectiveCategory() };
    delete payload.categoriePersonnalisee;
    if (!payload.expiration_date) payload.expiration_date = null;
    // Préserver la date de fabrication (absente du formulaire)
    payload.date_manufacture = this.data.isEditMode && this.data.article?.date_manufacture
      ? String(this.data.article.date_manufacture).substring(0, 10)
      : null;

    const request = this.data.isEditMode
      ? this.artService.updateArticle(this.data.article.id, payload)
      : this.artService.createArticle(payload);

    request.subscribe({
      next: (res: any) => {
        this.loading = false;
        this.dialogRef.close(res);
      },
      error: (err: any) => {
        this.loading = false;
        this.toast.error(err?.error?.message || err?.message || 'Erreur lors de l\'enregistrement');
      },
    });
  }
}