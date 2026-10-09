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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterPage],
      providers: [
        provideRouter([{ path: 'dashboard', component: DashboardStubComponent }]),
        {
          provide: AuthService,
          useValue: { register: vi.fn().mockResolvedValue({}) },
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

  it('should register with valid details', async () => {
    component.name = 'Juan Dela Cruz';
    component.email = 'juan@example.com';
    component.phone = '09171234567';
    component.password = 'secret12';
    component.confirmPassword = 'secret12';

    await component.register();

    expect(component.errorMessage()).toBe('');
    expect(component.loading()).toBe(false);
  });
});
