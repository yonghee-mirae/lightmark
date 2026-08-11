// Heading id generation. Pure and stateful per document: duplicate text gets a -1, -2, ... suffix.

export interface Slugger {
  slug(text: string): string;
}

export function createSlugger(): Slugger {
  const counts = new Map<string, number>();
  return {
    slug(text: string): string {
      const base =
        text
          .toLowerCase()
          .trim()
          .replace(/[^\p{L}\p{N}\s-]/gu, '')
          .replace(/\s+/g, '-') || 'section';
      const count = counts.get(base) ?? 0;
      counts.set(base, count + 1);
      return count === 0 ? base : `${base}-${count}`;
    },
  };
}
