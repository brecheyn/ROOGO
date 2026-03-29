import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { Category } from '../../../core/services/categories.service';

@Component({
    selector: 'app-category-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule
    ],
    templateUrl: './category-dialog.html',
    styleUrls: ['./category-dialog.scss']
})
export class CategoryDialogComponent {
    categoryForm: FormGroup;
    isEditMode: boolean;

    constructor(
        private fb: FormBuilder,
        private dialogRef: MatDialogRef<CategoryDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: Category | null
    ) {
        this.isEditMode = !!data;
        this.categoryForm = this.fb.group({
            name: [data?.name || '', [Validators.required, Validators.maxLength(100)]],
            description: [data?.description || '', Validators.maxLength(500)]
        });
    }

    onSubmit(): void {
        if (this.categoryForm.valid) {
            this.dialogRef.close(this.categoryForm.value);
        }
    }

    onCancel(): void {
        this.dialogRef.close();
    }
}