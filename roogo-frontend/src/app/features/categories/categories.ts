import { Component, OnDestroy } from '@angular/core';
import { Observable, Subject, takeUntil } from 'rxjs';
import { CommonModule } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { CategoriesService, Category } from '../../core/services/categories.service';
import { CategoryDialogComponent } from './category-dialog/category-dialog';
import { ConfirmDialogComponent } from '../../shared/components/comfirm-dialog/confirm-dialog';

@Component({
    selector: 'app-categories',
    standalone: true,
    imports: [
        CommonModule,
        MatDialogModule,
        MatSnackBarModule,
        MatTableModule,
        MatButtonModule,
        MatIconModule,
        MatToolbarModule,
        MatTooltipModule,
        MatCardModule
    ],
    templateUrl: './categories.html',
    styleUrls: ['./categories.scss'],
})
export class CategoriesComponent implements OnDestroy {
    displayedColumns: string[] = ['name', 'description', 'actions'];
    selectedCategory: Category | null = null;
    private destroy$ = new Subject<void>();

    get categories$(): Observable<Category[]> {
        return this.categoriesService.categories$;
    }

    constructor(
        private categoriesService: CategoriesService,
        private dialog: MatDialog,
        private snackBar: MatSnackBar
    ) {}

    onSelectCategory(category: Category): void {
        this.selectedCategory = category;
    }

    onAddCategory(): void {
        const dialogRef = this.dialog.open(CategoryDialogComponent, {
            width: '500px',
            data: null
        });

        dialogRef.afterClosed()
            .pipe(takeUntil(this.destroy$))
            .subscribe(result => {
                if (result) {
                    this.createCategory(result);
                }
            });
    }

    onEditCategory(category: Category): void {
        const dialogRef = this.dialog.open(CategoryDialogComponent, {
            width: '500px',
            data: category
        });

        dialogRef.afterClosed()
            .pipe(takeUntil(this.destroy$))
            .subscribe(result => {
                if (result) {
                    this.updateCategory(category.id, result);
                }
            });
    }

    onDeleteCategory(category: Category): void {
        const dialogRef = this.dialog.open(ConfirmDialogComponent, {
            width: '400px',
            data: {
                title: 'Delete Category',
                message: `Are you sure you want to delete "${category.name}"?`,
                confirmText: 'Delete',
                cancelText: 'Cancel'
            }
        });

        dialogRef.afterClosed()
            .pipe(takeUntil(this.destroy$))
            .subscribe(confirmed => {
                if (confirmed) {
                    this.deleteCategory(category.id);
                }
            });
    }

    private createCategory(category: Omit<Category, 'id'>): void {
        this.categoriesService.createCategory(category)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: () => {
                    this.snackBar.open('Category created successfully', 'Close', {
                        duration: 3000,
                        horizontalPosition: 'end',
                        verticalPosition: 'top'
                    });
                },
                error: (error) => {
                    this.snackBar.open('Failed to create category', 'Close', {
                        duration: 3000,
                        panelClass: ['error-snackbar']
                    });
                    console.error('Error creating category:', error);
                }
            });
    }

    private updateCategory(id: string, category: Partial<Category>): void {
        this.categoriesService.updateCategory(id, category)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: () => {
                    this.snackBar.open('Category updated successfully', 'Close', {
                        duration: 3000,
                        horizontalPosition: 'end',
                        verticalPosition: 'top'
                    });
                },
                error: (error) => {
                    this.snackBar.open('Failed to update category', 'Close', {
                        duration: 3000,
                        panelClass: ['error-snackbar']
                    });
                    console.error('Error updating category:', error);
                }
            });
    }

    private deleteCategory(id: string): void {
        this.categoriesService.deleteCategory(id)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: () => {
                    this.snackBar.open('Category deleted successfully', 'Close', {
                        duration: 3000,
                        horizontalPosition: 'end',
                        verticalPosition: 'top'
                    });
                    if (this.selectedCategory?.id === id) {
                        this.selectedCategory = null;
                    }
                },
                error: (error) => {
                    this.snackBar.open('Failed to delete category', 'Close', {
                        duration: 3000,
                        panelClass: ['error-snackbar']
                    });
                    console.error('Error deleting category:', error);
                }
            });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }
}