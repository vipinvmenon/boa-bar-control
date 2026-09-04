import { Navigate } from '@tanstack/react-router'

/**
 * Settings is now part of More. Keep this route as a compatibility redirect so
 * bookmarks and older links continue to land in the single options index.
 *
 * BAR-172 — `replace`, not a push.
 *
 * Without it this redirect left `/settings` in the history behind `/more`, and
 * three screens navigated *back* to `/settings`, so the stack filled with
 * `/settings → /more` pairs. Hardware Back popped to `/settings`, which
 * immediately pushed `/more` again: the most-used control on an Android phone
 * appeared frozen, and an app whose Back button does nothing gets force-quit.
 * Driven live before the fix, `history.back()` from `/more` landed on `/more`
 * both times. The three back buttons now point at `/more` directly, so nothing
 * pushes this route at all — the redirect exists only for old links.
 */
export function SettingsScreen() {
  return <Navigate to="/more" replace />
}
