import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { catchError, firstValueFrom, of } from 'rxjs';
import { AuthService } from '../../services/auth.service';

export const authGuard: CanMatchFn = async (_route, segments, _snapshot) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const user = await firstValueFrom(
    auth.user$.pipe(catchError(() => of(null)))
  );

  if (user) {
    return true;
  }

  const url = '/' + segments.map((segment) => segment.path).join('/');
  return router.createUrlTree(['/login'], {
    queryParams: { redirect: url },
  });
};
