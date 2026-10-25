const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

export function initials(name: string | null | undefined, fallback = '?'): string {
  return esc((name || fallback).trim().slice(0, 2).toUpperCase());
}
