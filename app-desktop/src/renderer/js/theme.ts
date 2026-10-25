export function resolveTheme(theme: string): string {
  if (theme === 'system') {
    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return isDark ? 'dark' : 'light';
  }
  if (theme === 'day') return 'light';
  if (theme === 'night') return 'dark';
  return theme || 'dark';
}
