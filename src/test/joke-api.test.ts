import { describe, expect, it } from "vitest";
import {
  buildJokeApiUrl,
  jokeFromApiResponse,
  normalizeCategories,
} from "../lib/jokeApi";

describe("JokeAPI integration helpers", () => {
  it("normalizes empty and Miscellaneous category input", () => {
    expect(normalizeCategories("")).toBe("Programming,Misc,Dark,Pun");
    expect(normalizeCategories("Programming, Miscellaneous, Pun")).toBe(
      "Programming,Misc,Pun",
    );
  });

  it("builds an English URL with required blacklist flags", () => {
    const url = buildJokeApiUrl("Programming,Miscellaneous,Dark,Pun");
    expect(url).toBe(
      "https://v2.jokeapi.dev/joke/Programming,Misc,Dark,Pun?blacklistFlags=nsfw%2Cracist%2Csexist%2Cexplicit&lang=en",
    );
  });

  it("maps a single JokeAPI response to an archive-compatible joke", () => {
    expect(
      jokeFromApiResponse({
        error: false,
        category: "Programming",
        type: "single",
        joke: "Debugging: Removing the needles from the haystack.",
        flags: {
          nsfw: false,
          religious: false,
          political: false,
          racist: false,
          sexist: false,
          explicit: false,
        },
        id: 40,
        safe: true,
        lang: "en",
      }),
    ).toEqual({
      id: "jokeapi-40",
      type: "single",
      text: "Debugging: Removing the needles from the haystack.",
    });
  });

  it("maps a two-part JokeAPI response to setup and punchline", () => {
    expect(
      jokeFromApiResponse({
        error: false,
        category: "Pun",
        type: "twopart",
        setup: "Why did the Romanian stop reading?",
        delivery: "They wanted to give the Bucharest.",
        flags: {
          nsfw: false,
          religious: false,
          political: false,
          racist: false,
          sexist: false,
          explicit: false,
        },
        id: 85,
        safe: true,
        lang: "en",
      }),
    ).toEqual({
      id: "jokeapi-85",
      type: "setup-punchline",
      setup: "Why did the Romanian stop reading?",
      punchline: "They wanted to give the Bucharest.",
    });
  });

  it("rejects forbidden flags even if the API response shape is otherwise valid", () => {
    expect(() =>
      jokeFromApiResponse({
        error: false,
        category: "Programming",
        type: "single",
        joke: "Nope.",
        flags: {
          nsfw: true,
          religious: false,
          political: false,
          racist: false,
          sexist: false,
          explicit: false,
        },
        id: 1,
        safe: false,
        lang: "en",
      }),
    ).toThrow(/forbidden safety flag/);
  });
});
