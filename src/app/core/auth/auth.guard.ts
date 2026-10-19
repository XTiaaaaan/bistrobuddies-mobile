import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { SignInPromptService } from './sign-in-prompt.service';

/**
 * Keeps private routes private without dead-ending guests: they see the
 * reusable sign-in prompt, and dismissing it leaves them on the current page.
 */
export const authGuard: CanMatchFn = async (_route, segments) => {
  const router = inject(Router);
  const prompt = inject(SignInPromptService);

  const result = await prompt.state();
  if (result === 'signed-in') {
    return true;
  }

  const target = '/' + segments.map((segment) => segment.path).join('/');

  if (result === 'sign-in') {
    return router.createUrlTree(['/login'], {
      queryParams: { redirect: target },
    });
  }

  // A guest dismissed the prompt: never leave the router with an unmatched
  // URL. On a cold start there is no page behind the prompt, so fall back to
  // the public dashboard instead.
  const current = router.url;
  return current && current !== '/'
    ? router.parseUrl(current)
    : router.createUrlTree(['/dashboard']);
};
