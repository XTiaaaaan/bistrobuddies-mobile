/**
 * Pull-to-refresh plumbing shared by the pages that render an `ion-refresher`.
 */

/**
 * Minimal shape of the `ionRefresh` event: the event target is the
 * `ion-refresher` element itself, whose `complete()` closes the spinner.
 */
export type RefresherEvent = { target: { complete: () => Promise<void> } };

/**
 * Runs a page's refresh work and always closes the pull-to-refresh spinner,
 * even when the work fails — a failed refresh must never leave the spinner
 * hanging on screen.
 */
export async function withRefresh(
  event: RefresherEvent,
  work: () => Promise<unknown>
): Promise<void> {
  try {
    await work();
  } finally {
    await event.target.complete();
  }
}
