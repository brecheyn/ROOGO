import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SaleList } from './sale-list';

describe('SaleList', () => {
  let component: SaleList;
  let fixture: ComponentFixture<SaleList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SaleList]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SaleList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
