import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { of } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import {
  SIGN_IN_REQUIRED_MESSAGE,
  SIGN_IN_REQUIRED_TITLE,
  SignInPromptService,
} from './sign-in-prompt.service';

describe('SignInPromptService', () => {
  let create: ReturnType<typeof vi.fn>;
  let present: ReturnType<typeof vi.fn>;
  let onDidDismiss: ReturnType<typeof vi.fn>;

  function configure(
    user: unknown,
    options: {
      role?: string;
      onDidDismiss?: () => Promise<{ role: string }>;
    } = {}
  ): void {
    present = vi.fn(() => Promise.resolve());
    onDidDismiss = vi.fn(
      options.onDidDismiss ??
        (() => Promise.resolve({ role: options.role as string }))
    );
    create = vi.fn(() => Promise.resolve({ present, onDidDismiss }));

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user$: of(user) } },
        { provide: AlertController, useValue: { create } },
      ],
    });
  }

  afterEach(() => TestBed.resetTestingModule());

  it('presents the shared copy with a close and a sign-in action', async () => {
    configure(null, { role: 'cancel' });
    const service = TestBed.inject(SignInPromptService);

    await expect(service.state()).resolves.toBe('dismissed');

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        header: SIGN_IN_REQUIRED_TITLE,
        message: SIGN_IN_REQUIRED_MESSAGE,
        cssClass: 'bb-signin-alert',
        backdropDismiss: true,
      })
    );

    const alertOptions = create.mock.calls[0][0] as {
      buttons: { text: string; role: string; cssClass: string }[];
    };
    expect(alertOptions.buttons).toEqual([
      { text: '✕', role: 'cancel', cssClass: 'bb-signin-close' },
      {
        text: 'Sign In / Log In',
        role: 'sign-in',
        cssClass: 'bb-signin-action',
      },
    ]);
    expect(present).toHaveBeenCalledTimes(1);
  });

  it('reports the sign-in choice when the action is tapped', async () => {
    configure(null, { role: 'sign-in' });
    const service = TestBed.inject(SignInPromptService);

    await expect(service.state()).resolves.toBe('sign-in');
  });

  it('never prompts an already signed-in customer', async () => {
    configure({ uid: 'customer-1' });
    const service = TestBed.inject(SignInPromptService);

    await expect(service.state()).resolves.toBe('signed-in');
    expect(create).not.toHaveBeenCalled();
  });

  it('navigates to login with a redirect only after choosing Sign In', async () => {
    configure(null, { role: 'sign-in' });
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const service = TestBed.inject(SignInPromptService);

    await expect(service.requireSignIn('/cart')).resolves.toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { redirect: '/cart' },
    });
  });

  it('stays on the current page when the prompt is dismissed', async () => {
    configure(null, { role: 'backdrop' });
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const service = TestBed.inject(SignInPromptService);

    await expect(service.requireSignIn('/profile')).resolves.toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('lets signed-in customers continue without a redirect', async () => {
    configure({ uid: 'customer-1' });
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const service = TestBed.inject(SignInPromptService);

    await expect(service.requireSignIn('/checkout')).resolves.toBe(true);
    expect(create).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('shares one alert between rapid taps', async () => {
    let finish: (value: { role: string }) => void = () => undefined;
    configure(null, {
      onDidDismiss: () =>
        new Promise<{ role: string }>((resolve) => {
          finish = resolve;
        }),
    });
    const service = TestBed.inject(SignInPromptService);

    const first = service.state();
    const second = service.state();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(create).toHaveBeenCalledTimes(1);
    finish({ role: 'cancel' });
    await expect(first).resolves.toBe('dismissed');
    await expect(second).resolves.toBe('dismissed');
  });
});
