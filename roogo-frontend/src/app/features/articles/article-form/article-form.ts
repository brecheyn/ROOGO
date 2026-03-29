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
    @Inject(MAT_DIALOG_DATA) public data: { isEditMode: boolean; article?: any },
  ) {}

  ngOnInit(): void {
    this.articleForm = this.fb.group({
      nom:         ['', [Validators.required, Validators.minLength(3)]],
      categorie:   ['', Validators.required],
      description: [''],
      prix:        [0, [Validators.required, Validators.min(0)]],
      stock:       [0, [Validators.required, Validators.min(0)]],
    });
    if (this.data.isEditMode && this.data.article) {
      this.articleForm.patchValue(this.data.article);
    }
  }

  formatPrice(value: number): string {
    return value?.toLocaleString('fr-FR', { style: 'currency', currency: 'XOF' });
  }

  onCancel(): void { this.dialogRef.close(); }

  onSubmit(): void {
    if (this.articleForm.invalid) return;
    this.loading = true;

    const request = this.data.isEditMode
      ? this.artService.updateArticle(this.data.article.id, this.articleForm.value)
      : this.artService.createArticle(this.articleForm.value);

    request.subscribe({
      next: (res: any) => { this.loading = false; this.dialogRef.close(res); },
      error: (err: any) => { this.loading = false; console.error('Erreur:', err); },
    });
  }
  categories = [  'Électronique', 'Vêtements',  'Alimentation',  'Maison',  'Jouets',  'Livres',  'Beauté',  'Sport',  'Automobile',  'Santé' ];  
}