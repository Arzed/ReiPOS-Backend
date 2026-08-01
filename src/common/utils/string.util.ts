/**
 * Converts a string to Title Case / Capitalized format.
 * Example: "abc kopi susu 30 gr" -> "Abc Kopi Susu 30 Gr"
 */
export function capitalizeTitle(str: string): string {
  if (!str) return str;
  return str
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map(word => {
      if (word.length === 0) return '';
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}
