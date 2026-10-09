import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { LoginPage } from './login.page';

@Component({ selector: 'app-dashboard-stub', standalone: true, template: '' })
class DashboardStubComponent {}

describe('LoginPage', () => {
  let component: LoginPage;
  let fixture: ComponentFixture<LoginPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([{ path: 'dashboard', component: DashboardStubComponent }]),
        {
          provide: AuthService,
          useValue: {
            user$: of(null),
            login: vi.fn().mockResolvedValue({}),
            loginWithGoogle: vi.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show a validation message when credentials are empty', async () => {
    await component.signIn();
    expect(component.errorMessage()).toContain('email and password');
  });

  it('should sign in with email and password', async () => {
    component.email = 'juan@example.com';
    component.password = 'secret12';

    await component.signIn();

    expect(component.errorMessage()).toBe('');
    expect(component.loading()).toBe(false);
  });

  it('should sign in with Google', async () => {
    await component.signInWithGoogle();

    expect(component.errorMessage()).toBe('');
    expect(component.googleLoading()).toBe(false);
    expect(component.googleHint()).toBe('');
  });

  it('should report progress while signing in', async () => {
    const auth = TestBed.inject(AuthService);
    vi.mocked(auth.login).mockImplementation(async (_email, _password, onProgress) => {
      onProgress?.('Saving your profile...');
      return {} as never;
    });

    component.email = 'juan@example.com';
    component.password = 'secret12';
    await component.signIn();

    expect(auth.login).toHaveBeenCalledWith(
      'juan@example.com',
      'secret12',
      expect.any(Function)
    );
    expect(component.status()).toBe('');
  });
});
