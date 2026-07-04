// Pure logic for the release manifest (releases.json) the publish script maintains on
// the update feed. The platform's public download page renders this list — version,
// date, installer file, size, notes — newest first (the server sorts by date).

// Returns a new list with `entry` added, replacing any existing entry for the same
// version (re-publishing a version updates it rather than duplicating it). A corrupt
// existing manifest starts fresh rather than failing the publish.
export function upsertRelease(existing, entry) {
  const list = Array.isArray(existing) ? existing : []
  return [...list.filter((r) => r?.version !== entry.version), entry]
}
