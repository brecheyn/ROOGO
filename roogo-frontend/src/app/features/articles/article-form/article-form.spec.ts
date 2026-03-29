import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ArticleFormDialogComponent } from './article-form';

describe('ArticleFormDialogComponent', () => {
  let component: ArticleFormDialogComponent;
  let fixture: ComponentFixture<ArticleFormDialogComponent>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArticleFormDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ArticleFormDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
