'use client'

// Module-level flag shared by the page editors (via SaveBar) and the admin
// navigation, so switching pages from the admin bar can warn about unsaved
// edits — the browser's own beforeunload prompt doesn't cover client-side
// navigation.
let unsaved = false

export function setUnsavedChanges(value: boolean) {
  unsaved = value
}

export function confirmLeaveWithUnsavedChanges() {
  if (!unsaved) return true
  return window.confirm('You have unsaved changes on this page. Leave without saving them?')
}
