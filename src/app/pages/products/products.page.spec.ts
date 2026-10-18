import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProductsService } from '../../services/products.service';
import { ProductsPage } from './products.page';

describe('ProductsPage', () => {
  let component: ProductsPage;
  let fixture: ComponentFixture<ProductsPage>;
  let watchProducts: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    watchProducts = vi.fn(() => of([]));

    await TestBed.configureTestingModule({
      imports: [ProductsPage],
      providers: [
        provideRouter([]),
        {
          provide: ProductsService,
          useValue: { watchProducts },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should reload the menu and close the spinner when the customer pulls to refresh', async () => {
    const complete = vi.fn(() => Promise.resolve());

    await component.onRefresh({ target: { complete } });
    fixture.detectChanges();

    expect(watchProducts).toHaveBeenCalledTimes(2);
    expect(complete).toHaveBeenCalledTimes(1);
  });
});
