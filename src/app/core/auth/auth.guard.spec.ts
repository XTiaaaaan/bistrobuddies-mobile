import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Route, Router, UrlSegment, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  const route = { path: 'dashboard' } as Route;
  const segments = [{ path: 'dashboard' }] as UrlSegment[];

  const runGuard = async () =>
    runInInjectionContext(TestBed.inject(EnvironmentInjector), () =>
      authGuard(route, segments, {} as never)
    );

  const configure = (user: unknown) => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user$: of(user) } },
      ],
    });
  };

  it('should allow signed-in customers', async () => {
    configure({ uid: 'customer-1' });

    await expect(runGuard()).resolves.toBe(true);
  });

  it('should redirect anonymous visitors to the login page', async () => {
    configure(null);

    const result = await runGuard();
    const router = TestBed.inject(Router);

    expect(router.serializeUrl(result as never)).toContain('/login');
    expect(router.serializeUrl(result as never)).toContain('dashboard');
  });
});
