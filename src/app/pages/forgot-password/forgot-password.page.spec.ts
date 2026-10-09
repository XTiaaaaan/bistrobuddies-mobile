import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ForgotPasswordPage } from './forgot-password.page';

describe('ForgotPasswordPage', () => {
  let component: ForgotPasswordPage;
  let fixture: ComponentFixture<ForgotPasswordPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForgotPasswordPage],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { sendPasswordReset: vi.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should require an email address', async () => {
    await component.sendResetLink();
    expect(component.errorMessage()).toContain('email address');
    expect(component.sent()).toBe(false);
  });

  it('should show a confirmation after the reset email is sent', async () => {
    component.email = 'juan@example.com';
    await component.sendResetLink();
    expect(component.sent()).toBe(true);
  });
});
