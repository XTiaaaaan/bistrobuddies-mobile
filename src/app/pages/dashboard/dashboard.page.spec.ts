import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ProductsService } from '../../services/products.service';
import { DashboardPage } from './dashboard.page';

describe('DashboardPage', () => {
  let component: DashboardPage;
  let fixture: ComponentFixture<DashboardPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
        {
          provide: AuthService,
          useValue: {
            user$: of({ displayName: 'Juan dela Cruz', email: 'juan@example.com' }),
          },
        },
        {
          provide: ProductsService,
          useValue: { watchProducts: () => of([]) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should welcome the signed-in customer by name', () => {
    expect(component.customerName()).toBe('Juan dela Cruz');
  });
});
