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

// Pulls the version and the installer filename from electron-builder's latest.yml —
// the authoritative record of what THIS build produced. Using it (rather than scanning
// release/ for any *.exe) means a stale installer left over from an earlier build can't
// be mislabeled as the new version. The top-level `path:` is the installer; the indented
// `url:` under `files:` is ignored by the anchored, multiline regexes.
export function parseLatestYml(text) {
  return {
    version: text.match(/^version:\s*(.+?)\s*$/m)?.[1],
    file: text.match(/^path:\s*(.+?)\s*$/m)?.[1]
  }
}
