import type { ArchiveEntry, Joke } from "./types";
import { sameJoke } from "./jokes";

const endpoint = "https://v2.jokeapi.dev/joke";
const blacklistFlags = ["nsfw", "racist", "sexist", "explicit"];
export const jokeApiCategories = [
  "Programming",
  "Misc",
  "Dark",
  "Pun",
] as const;
export type JokeApiCategory = (typeof jokeApiCategories)[number];
const maxAttempts = 3;

type JokeApiResponse =
  | {
      error: false;
      category: string;
      type: "single";
      joke: string;
      flags: Record<string, boolean>;
      id: number;
      safe: boolean;
      lang: string;
    }
  | {
      error: false;
      category: string;
      type: "twopart";
      setup: string;
      delivery: string;
      flags: Record<string, boolean>;
      id: number;
      safe: boolean;
      lang: string;
    }
  | {
      error: true;
      message?: string;
      additionalInfo?: string;
    };

export function normalizeCategories(
  selectedCategories: JokeApiCategory[],
): JokeApiCategory[] {
  return selectedCategories.length > 0
    ? selectedCategories
    : [...jokeApiCategories];
}

export function buildJokeApiUrl(selectedCategories: JokeApiCategory[]): string {
  const categoryPath = normalizeCategories(selectedCategories)
    .map((category) => encodeURIComponent(category))
    .join(",");
  const params = new URLSearchParams({
    blacklistFlags: blacklistFlags.join(","),
    lang: "en",
  });
  return `${endpoint}/${categoryPath}?${params.toString()}`;
}

export function jokeFromApiResponse(response: JokeApiResponse): Joke {
  if (response.error) {
    throw new Error(
      response.additionalInfo ??
        response.message ??
        "JokeAPI rejected the request.",
    );
  }
  if (response.lang !== "en") {
    throw new Error("JokeAPI returned a non-English joke.");
  }
  if (blacklistFlags.some((flag) => response.flags?.[flag])) {
    throw new Error("JokeAPI returned a joke with a forbidden safety flag.");
  }
  if (response.type === "single") {
    return {
      id: `jokeapi-${response.id}`,
      type: "single",
      text: response.joke,
    };
  }
  return {
    id: `jokeapi-${response.id}`,
    type: "setup-punchline",
    setup: response.setup,
    punchline: response.delivery,
  };
}

export async function fetchSuggestedJoke(
  selectedCategories: JokeApiCategory[],
  archive: ArchiveEntry[],
  fetcher: typeof fetch = fetch,
): Promise<Joke> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await fetcher(buildJokeApiUrl(selectedCategories));
      if (!response.ok) {
        throw new Error(`JokeAPI returned HTTP ${response.status}.`);
      }
      const joke = jokeFromApiResponse(
        (await response.json()) as JokeApiResponse,
      );
      if (!archive.some((entry) => sameJoke(joke, entry))) {
        return joke;
      }
      lastError = new Error(
        "JokeAPI returned a joke that is already archived.",
      );
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Could not fetch a suggested joke.");
}
