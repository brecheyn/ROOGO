import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

export interface Category {
    id: string;
    name: string;
    description?: string;
}

@Injectable({
    providedIn: 'root'
})
export class CategoriesService {
    private apiUrl = '/api/categories';
    private categoriesSubject = new BehaviorSubject<Category[]>([]);
    public categories$ = this.categoriesSubject.asObservable();

    constructor(private http: HttpClient) {
        this.loadCategories();
    }

    loadCategories(): void {
        this.http.get<Category[]>(this.apiUrl).pipe(
            tap(categories => this.categoriesSubject.next(categories)),
            catchError(error => {
                console.error('Error loading categories:', error);
                return throwError(() => error);
            })
        ).subscribe();
    }

    getCategoryById(id: string): Observable<Category> {
        return this.http.get<Category>(`${this.apiUrl}/${id}`).pipe(
            catchError(error => {
                console.error('Error getting category:', error);
                return throwError(() => error);
            })
        );
    }

    createCategory(category: Omit<Category, 'id'>): Observable<Category> {
        return this.http.post<Category>(this.apiUrl, category).pipe(
            tap(() => this.loadCategories()),
            catchError(error => {
                console.error('Error creating category:', error);
                return throwError(() => error);
            })
        );
    }

    updateCategory(id: string, category: Partial<Category>): Observable<Category> {
        return this.http.put<Category>(`${this.apiUrl}/${id}`, category).pipe(
            tap(() => this.loadCategories()),
            catchError(error => {
                console.error('Error updating category:', error);
                return throwError(() => error);
            })
        );
    }

    deleteCategory(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
            tap(() => this.loadCategories()),
            catchError(error => {
                console.error('Error deleting category:', error);
                return throwError(() => error);
            })
        );
    }
}