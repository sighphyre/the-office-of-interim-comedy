import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import {
  parseSubmissionBody,
  sortArchiveEntries,
  todayInTimezone,
  unusedSuggestions,
  validateSubmission,
} from "../../scripts/joke-core.mjs";

const execFileAsync = promisify(execFile);

const team = {
  members: [
    { github: "alice-gh", name: "Alice" },
    { github: "bob-gh", name: "Bob" },
  ],
};
const schedule = {
  timezone: "Africa/Johannesburg",
  entries: [
    { date: "2026-07-27", github: "alice-gh" },
    { date: "2026-07-28", github: "bob-gh" },
  ],
};
const emptyArchive = { entries: [] };

function issue(body, login = "alice-gh", number = 42) {
  return {
    number,
    body,
    user: { login },
    labels: [{ name: "daily-joke" }],
  };
}

function bodyFor(joke, date = "2026-07-27") {
  const content =
    joke.type === "single"
      ? `### Text\n\n${joke.text}`
      : `### Setup\n\n${joke.setup}\n\n### Punchline\n\n${joke.punchline}`;
  return `<!-- daily-joke-submission:start -->
<!-- version:1 -->
<!-- date:${date} -->
<!-- type:${joke.type} -->

${content}

<!-- daily-joke-submission:end -->`;
}

describe("timezone helper", () => {
  it("calculates today in the configured timezone", () => {
    expect(
      todayInTimezone(
        "Africa/Johannesburg",
        new Date("2026-07-22T22:30:00.000Z"),
      ),
    ).toBe("2026-07-23");
  });
});

describe("submission parsing", () => {
  it("parses a valid one-line joke", () => {
    expect(
      parseSubmissionBody(
        bodyFor({
          type: "single",
          text: "A <boulder> is just a committed pebble.",
        }),
      ),
    ).toEqual({
      version: "1",
      date: "2026-07-27",
      type: "single",
      text: "A <boulder> is just a committed pebble.",
      setup: "",
      punchline: "",
    });
  });

  it("parses a valid setup and punchline", () => {
    expect(
      parseSubmissionBody(
        bodyFor({
          type: "setup-punchline",
          setup: "Why?",
          punchline: "Because.",
        }),
      ),
    ).toMatchObject({
      type: "setup-punchline",
      setup: "Why?",
      punchline: "Because.",
    });
  });

  it("rejects malformed markers", () => {
    expect(() => parseSubmissionBody("## Daily joke submission")).toThrow(
      /markers/,
    );
  });

  it("handles special Markdown characters as plain text", () => {
    const parsed = parseSubmissionBody(
      bodyFor({ type: "single", text: "**bold** [link](x) `code`" }),
    );
    expect(parsed.text).toBe("**bold** [link](x) `code`");
  });
});

describe("submission validation", () => {
  it("accepts the assigned authenticated GitHub user", () => {
    const submission = parseSubmissionBody(
      bodyFor({ type: "single", text: "Filed correctly." }),
    );
    expect(
      validateSubmission({
        issue: issue("body"),
        submission,
        team,
        schedule,
        archive: emptyArchive,
      }),
    ).toMatchObject({
      accepted: true,
    });
  });

  it("rejects unknown GitHub users", () => {
    const submission = parseSubmissionBody(
      bodyFor({ type: "single", text: "No badge." }),
    );
    expect(
      validateSubmission({
        issue: issue("body", "stranger-gh"),
        submission,
        team,
        schedule,
        archive: emptyArchive,
      }),
    ).toMatchObject({ accepted: false });
  });

  it("rejects users who are not assigned", () => {
    const submission = parseSubmissionBody(
      bodyFor({ type: "single", text: "Wrong rota." }),
    );
    expect(
      validateSubmission({
        issue: issue("body", "bob-gh"),
        submission,
        team,
        schedule,
        archive: emptyArchive,
      }),
    ).toMatchObject({
      accepted: false,
    });
  });

  it("rejects duplicate dates", () => {
    const submission = parseSubmissionBody(
      bodyFor({ type: "single", text: "Already done." }),
    );
    const archive = {
      entries: [
        { date: "2026-07-27", github: "alice-gh", type: "single", text: "Old" },
      ],
    };
    expect(
      validateSubmission({
        issue: issue("body"),
        submission,
        team,
        schedule,
        archive,
      }),
    ).toMatchObject({
      accepted: false,
    });
  });

  it("rejects oversized fields", () => {
    const submission = parseSubmissionBody(
      bodyFor({ type: "single", text: "x".repeat(501) }),
    );
    expect(
      validateSubmission({
        issue: issue("body"),
        submission,
        team,
        schedule,
        archive: emptyArchive,
      }),
    ).toMatchObject({
      accepted: false,
    });
  });
});

describe("archive and suggestions", () => {
  it("sorts archive entries by date", () => {
    expect(
      sortArchiveEntries([{ date: "2026-07-28" }, { date: "2026-07-27" }]).map(
        (entry) => entry.date,
      ),
    ).toEqual(["2026-07-27", "2026-07-28"]);
  });

  it("prefers unused suggestions", () => {
    const suggestions = [
      { id: "used", type: "single", text: "Done" },
      { id: "fresh", type: "single", text: "New" },
    ];
    expect(
      unusedSuggestions([{ type: "single", text: "Done" }], suggestions).map(
        (joke) => joke.id,
      ),
    ).toEqual(["fresh"]);
  });

  it("does not modify the archive after rejection", async () => {
    const dir = await mkdtemp(join(tmpdir(), "interim-comedy-"));
    const archivePath = join(dir, "archive.json");
    const issuePath = join(dir, "issue.json");
    const resultPath = join(dir, "result.json");
    const teamPath = join(dir, "team.json");
    const schedulePath = join(dir, "schedule.json");
    const archive = { entries: [] };

    await Promise.all([
      writeFile(archivePath, `${JSON.stringify(archive, null, 2)}\n`),
      writeFile(teamPath, `${JSON.stringify(team, null, 2)}\n`),
      writeFile(schedulePath, `${JSON.stringify(schedule, null, 2)}\n`),
      writeFile(
        issuePath,
        `${JSON.stringify(issue(bodyFor({ type: "single", text: "I am unauthorized." }), "stranger-gh"), null, 2)}\n`,
      ),
    ]);

    await execFileAsync("node", [
      "scripts/record-joke.mjs",
      "--issue",
      issuePath,
      "--result",
      resultPath,
      "--archive",
      archivePath,
      "--team",
      teamPath,
      "--schedule",
      schedulePath,
    ]);

    expect(JSON.parse(await readFile(resultPath, "utf8"))).toMatchObject({
      accepted: false,
    });
    expect(JSON.parse(await readFile(archivePath, "utf8"))).toEqual(archive);
  });
});
