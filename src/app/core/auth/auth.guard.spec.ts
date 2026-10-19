import { EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Route, Router, UrlSegment, provideRouter } from '@angular/router';
import { SignInPromptResult, SignInPromptService } from './sign-in-prompt.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  const route = { path: 'dashboard' } as Route;
  const segments = [{ path: 'dashboard' }] as UrlSegment[];

  const runGuard = async () =>
    runInInjectionContext(TestBed.inject(EnvironmentInjector), () =>
      authGuard(route, segments, {} as never)
    );

  const configure = (result: SignInPromptResult) => {
    const state = vi.fn(() => Promise.resolve(result));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SignInPromptService, useValue: { state } },
      ],
    });
    return state;
  };

  afterEach(() => TestBed.resetTestingModule());

  it('should allow signed-in customers without showing the prompt', async () => {
    const state = configure('signed-in');

    await expect(runGuard()).resolves.toBe(true);
    expect(state).toHaveBeenCalledTimes(1);
  });

  it('should send guests who choose Sign In to login with a redirect', async () => {
    configure('sign-in');

    const result = await runGuard();
    const router = TestBed.inject(Router);

    expect(router.serializeUrl(result as never)).toContain('/login');
    expect(router.serializeUrl(result as never)).toContain('dashboard');
  });

  it('should keep guests on the storefront when they dismiss the prompt', async () => {
    configure('dismissed');

    const result = await runGuard();
    const router = TestBed.inject(Router);

    expect(router.serializeUrl(result as never)).toBe('/dashboard');
    expect(router.serializeUrl(result as never)).not.toContain('/login');
  });
});
