// Shared by every admin-console export (Farm Owners, Monitored Trees,
// Alert History, Reports, Settings backup) so an exported file's
// contents can be verified later -- re-hash everything above the
// trailer/field and compare against the stamped value to detect
// tampering or a corrupted download.
//
// SubtleCrypto is only available in secure contexts (https/localhost),
// which this app already assumes (fetch to the backend has the same
// requirement in practice).

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// For CSV/plain-text exports: hashes `content`, appends it as a trailing
// comment line, then triggers the browser download. Returns the hash in
// case the caller wants to also show it in a toast.
export async function downloadTextWithHash(
  filename: string,
  content: string,
  mimeType: string,
  commentPrefix = '#'
): Promise<string> {
  const hash = await sha256Hex(content);
  const stamped = `${content}\n${commentPrefix} SHA-256: ${hash}\n`;
  const blob = new Blob([stamped], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return hash;
}

// For JSON exports: JSON has no comment syntax, so the hash is computed
// over the rest of the payload and added as its own `integrityHash`
// field instead of a trailer line.
export async function downloadJsonWithHash(
  filename: string,
  data: Record<string, unknown>
): Promise<string> {
  const hash = await sha256Hex(JSON.stringify(data));
  const stamped = { ...data, integrityHash: `sha256:${hash}` };
  const blob = new Blob([JSON.stringify(stamped, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return hash;
}
