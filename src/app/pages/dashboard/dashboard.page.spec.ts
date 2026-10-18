import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ProductsService } from '../../services/products.service';
import { DashboardPage } from './dashboard.page';

describe('DashboardPage', () => {
  let component: DashboardPage;
  let fixture: ComponentFixture<DashboardPage>;
  let watchProducts: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    watchProducts = vi.fn(() => of([]));

    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            user$: of({ displayName: 'Juan dela Cruz', email: 'juan@example.com' }),
          },
        },
        {
          provide: ProductsService,
          useValue: { watchProducts },
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

  it('should reload the latest coffee and close the spinner on pull-to-refresh', async () => {
    const complete = vi.fn(() => Promise.resolve());

    await component.onRefresh({ target: { complete } });
    fixture.detectChanges();

    expect(watchProducts).toHaveBeenCalledTimes(2);
    expect(complete).toHaveBeenCalledTimes(1);
  });
});
