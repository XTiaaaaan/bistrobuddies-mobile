import { withRefresh } from './refresher';

describe('withRefresh', () => {
  it('runs the refresh work and then closes the spinner', async () => {
    const complete = vi.fn(() => Promise.resolve());
    const work = vi.fn(() => Promise.resolve());

    await withRefresh({ target: { complete } }, work);

    expect(work).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('closes the spinner even when the refresh work fails', async () => {
    const complete = vi.fn(() => Promise.resolve());
    const work = vi.fn(() => Promise.reject(new Error('offline')));

    await expect(withRefresh({ target: { complete } }, work)).rejects.toThrow('offline');

    expect(complete).toHaveBeenCalledTimes(1);
  });
});
