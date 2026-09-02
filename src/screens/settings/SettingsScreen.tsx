import { Navigate } from '@tanstack/react-router'

/**
 * Settings is now part of More. Keep this route as a compatibility redirect so
 * bookmarks and older links continue to land in the single options index.
 */
export function SettingsScreen() {
  return <Navigate to="/more" />
}
