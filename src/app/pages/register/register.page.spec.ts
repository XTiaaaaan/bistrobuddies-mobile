import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { RegisterPage } from './register.page';

@Component({ selector: 'app-dashboard-stub', standalone: true, template: '' })
class DashboardStubComponent {}

describe('RegisterPage', () => {
  let component: RegisterPage;
  let fixture: ComponentFixture<RegisterPage>;
  let authRegister: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    authRegister = vi.fn().mockResolvedValue({});

    await TestBed.configureTestingModule({
      imports: [RegisterPage],
      providers: [
        provideRouter([{ path: 'dashboard', component: DashboardStubComponent }]),
        {
          provide: AuthService,
          useValue: { register: authRegister },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should require matching passwords', async () => {
    component.name = 'Juan Dela Cruz';
    component.email = 'juan@example.com';
    component.password = 'secret12';
    component.confirmPassword = 'different';

    await component.register();

    expect(component.errorMessage()).toContain('Passwords do not match');
  });

  it('should require an explicit Terms of Service acceptance', async () => {
    component.name = 'Juan Dela Cruz';
    component.email = 'juan@example.com';
    component.phone = '09171234567';
    component.password = 'secret12';
    component.confirmPassword = 'secret12';
    component.agreedToTerms = false;

    await component.register();

    expect(authRegister).not.toHaveBeenCalled();
    expect(component.errorMessage()).toContain('Terms of Service');
  });

  it('links the consent notice to the Terms', () => {
    const element = fixture.nativeElement as HTMLElement;
    const links = Array.from(element.querySelectorAll('.auth-consent a'));

    expect(links.map((link) => link.textContent?.trim())).toEqual([
      'Terms of Service',
    ]);
    expect(links[0].textContent).toContain('Terms of Service');
  });

  it('should register with valid details', async () => {
    component.name = 'Juan Dela Cruz';
    component.email = 'juan@example.com';
    component.phone = '09171234567';
    component.password = 'secret12';
    component.confirmPassword = 'secret12';
    component.agreedToTerms = true;

    await component.register();

    expect(authRegister).toHaveBeenCalledTimes(1);
    expect(component.errorMessage()).toBe('');
    expect(component.loading()).toBe(false);
  });
});
