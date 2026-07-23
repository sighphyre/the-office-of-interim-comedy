import type { ArchiveEntry, Joke } from "./types";

export function sameJoke(a: Joke, b: Joke): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "single" && b.type === "single") return a.text === b.text;
  if (a.type === "setup-punchline" && b.type === "setup-punchline") {
    return a.setup === b.setup && a.punchline === b.punchline;
  }
  return false;
}

export function filterUnusedSuggestions(
  archive: ArchiveEntry[],
  suggestions: Joke[],
): Joke[] {
  const unused = suggestions.filter(
    (suggestion) => !archive.some((entry) => sameJoke(suggestion, entry)),
  );
  return unused.length > 0 ? unused : suggestions;
}

export function pickSuggestion(candidates: Joke[], previousId?: string): Joke {
  const pool =
    candidates.length > 1 && previousId
      ? candidates.filter((joke) => joke.id !== previousId)
      : candidates;
  return pool[Math.floor(Math.random() * pool.length)];
}
