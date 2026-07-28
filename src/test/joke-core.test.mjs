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
  updateNextScheduleEntry,
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
    { date: "2026-07-28", github: "alice-gh" },
    { date: "2026-07-29", github: "bob-gh" },
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

function bodyFor(joke, date = "2026-07-28", nextGithub = "") {
  const content =
    joke.type === "single"
      ? `### Text\n\n${joke.text}`
      : `### Setup\n\n${joke.setup}\n\n### Punchline\n\n${joke.punchline}`;
  const nextLine = nextGithub ? `<!-- next-github:${nextGithub} -->\n` : "";
  return `<!-- daily-joke-submission:start -->
<!-- version:${nextGithub ? "2" : "1"} -->
<!-- date:${date} -->
<!-- type:${joke.type} -->
${nextLine}

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
      date: "2026-07-28",
      type: "single",
      text: "A <boulder> is just a committed pebble.",
      setup: "",
      punchline: "",
      nextGithub: "",
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

  it("parses a version 2 next jester selection", () => {
    const parsed = parseSubmissionBody(
      bodyFor(
        { type: "single", text: "Filed with a rota update." },
        "2026-07-28",
        "bob-gh",
      ),
    );
    expect(parsed).toMatchObject({
      version: "2",
      nextGithub: "bob-gh",
    });
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
        { date: "2026-07-28", github: "alice-gh", type: "single", text: "Old" },
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

  it("accepts a valid next jester from the team list", () => {
    const submission = parseSubmissionBody(
      bodyFor({ type: "single", text: "Next please." }, "2026-07-28", "bob-gh"),
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
      nextScheduleEntry: { date: "2026-07-29" },
      nextTeamMember: { github: "bob-gh" },
    });
  });

  it("rejects Monday submissions", () => {
    const mondaySchedule = {
      timezone: "Africa/Johannesburg",
      entries: [{ date: "2026-07-27", github: "alice-gh" }],
    };
    const submission = parseSubmissionBody(
      bodyFor({ type: "single", text: "Monday filing." }, "2026-07-27"),
    );
    expect(
      validateSubmission({
        issue: issue("body"),
        submission,
        team,
        schedule: mondaySchedule,
        archive: emptyArchive,
      }),
    ).toMatchObject({
      accepted: false,
      message: "Joke of the day is only active Tuesday through Friday.",
    });
  });

  it("rejects an unknown next jester", () => {
    const submission = parseSubmissionBody(
      bodyFor(
        { type: "single", text: "Next please." },
        "2026-07-28",
        "stranger-gh",
      ),
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
      sortArchiveEntries([{ date: "2026-07-29" }, { date: "2026-07-28" }]).map(
        (entry) => entry.date,
      ),
    ).toEqual(["2026-07-28", "2026-07-29"]);
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

  it("updates the next configured schedule entry", () => {
    const result = updateNextScheduleEntry(
      schedule,
      { date: "2026-07-29", github: "bob-gh" },
      "alice-gh",
    );
    expect(result).toMatchObject({
      changed: true,
      nextDate: "2026-07-29",
    });
    expect(result.schedule.entries.at(-1)).toEqual({
      date: "2026-07-29",
      github: "alice-gh",
    });
  });

  it("skips Monday when finding the next schedule entry", () => {
    const scheduleWithMonday = {
      timezone: "Africa/Johannesburg",
      entries: [
        { date: "2026-07-31", github: "alice-gh" },
        { date: "2026-08-03", github: "bob-gh" },
        { date: "2026-08-04", github: "bob-gh" },
      ],
    };
    const submission = parseSubmissionBody(
      bodyFor(
        { type: "single", text: "Friday filing." },
        "2026-07-31",
        "alice-gh",
      ),
    );
    expect(
      validateSubmission({
        issue: issue("body"),
        submission,
        team,
        schedule: scheduleWithMonday,
        archive: emptyArchive,
      }),
    ).toMatchObject({
      accepted: true,
      nextScheduleEntry: { date: "2026-08-04" },
    });
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
    expect(JSON.parse(await readFile(schedulePath, "utf8"))).toEqual(schedule);
  });

  it("updates the archive and next schedule entry after acceptance", async () => {
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
        `${JSON.stringify(issue(bodyFor({ type: "single", text: "Accepted." }, "2026-07-28", "alice-gh")), null, 2)}\n`,
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
      accepted: true,
      nextScheduleUpdated: true,
      nextDate: "2026-07-29",
      nextGithub: "alice-gh",
    });
    expect(
      JSON.parse(await readFile(archivePath, "utf8")).entries,
    ).toHaveLength(1);
    expect(
      JSON.parse(await readFile(schedulePath, "utf8")).entries.at(-1),
    ).toEqual({
      date: "2026-07-29",
      github: "alice-gh",
    });
  });
});
