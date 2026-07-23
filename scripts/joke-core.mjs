import { readFile } from "node:fs/promises";

export const FORMAT_VERSION = "1";
export const MAX_TEXT = 500;
export const MAX_SETUP = 300;
export const MAX_PUNCHLINE = 300;
export const START_MARKER = "<!-- daily-joke-submission:start -->";
export const END_MARKER = "<!-- daily-joke-submission:end -->";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export function todayInTimezone(timezone, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${value.year}-${value.month}-${value.day}`;
}

export function isValidDateString(date) {
  if (!DATE_RE.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return parsed.toISOString().slice(0, 10) === date;
}

export function normalizeLineEndings(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

export function hasRawHtml(value) {
  return /<\s*\/?\s*[a-z][^>]*>/i.test(value);
}

export function parseSubmissionBody(body) {
  const normalized = normalizeLineEndings(body);
  const start = normalized.indexOf(START_MARKER);
  const end = normalized.indexOf(END_MARKER);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("The issue body lacks the expected daily joke markers.");
  }
  if (normalized.indexOf(START_MARKER, start + START_MARKER.length) !== -1) {
    throw new Error("The issue body contains more than one start marker.");
  }

  const block = normalized.slice(start + START_MARKER.length, end).trim();
  const lines = block.split("\n");
  const metadata = {};
  let section = null;
  const sections = {};

  for (const line of lines) {
    const meta = line.match(/^<!--\s*(date|type|version):([^<>]*)\s*-->$/);
    if (meta) {
      metadata[meta[1]] = meta[2].trim();
      section = null;
      continue;
    }
    const heading = line.match(/^###\s+(Text|Setup|Punchline)\s*$/i);
    if (heading) {
      section = heading[1].toLowerCase();
      sections[section] = "";
      continue;
    }
    if (section) {
      sections[section] += `${line}\n`;
    }
  }

  const trimSection = (name) => (sections[name] ?? "").trim();
  const type = metadata.type;
  const parsed = {
    date: metadata.date,
    type,
    version: metadata.version,
    text: trimSection("text"),
    setup: trimSection("setup"),
    punchline: trimSection("punchline"),
  };

  return parsed;
}

export function validateJokeShape(submission) {
  if (submission.version !== FORMAT_VERSION) {
    return "Unsupported daily joke format version.";
  }
  if (!isValidDateString(submission.date ?? "")) {
    return "The submitted date is missing or invalid.";
  }
  if (submission.type !== "single" && submission.type !== "setup-punchline") {
    return "The submitted joke type is invalid.";
  }
  const values =
    submission.type === "single"
      ? [["one-line joke", submission.text, MAX_TEXT]]
      : [
          ["setup", submission.setup, MAX_SETUP],
          ["punchline", submission.punchline, MAX_PUNCHLINE],
        ];

  for (const [label, value, max] of values) {
    if (!value || !value.trim()) {
      return `The ${label} is required.`;
    }
    if (value.length > max) {
      return `The ${label} exceeds ${max} characters.`;
    }
    if (hasRawHtml(value)) {
      return "Raw HTML is not allowed in submitted jokes.";
    }
  }
  return null;
}

export function buildArchiveEntry({
  submission,
  issue,
  teamMember,
  recordedAt = new Date(),
}) {
  const base = {
    date: submission.date,
    github: issue.user.login,
    name: teamMember.name,
    type: submission.type,
    issueNumber: issue.number,
    recordedAt: recordedAt.toISOString(),
  };
  if (submission.type === "single") {
    return { ...base, text: submission.text };
  }
  return { ...base, setup: submission.setup, punchline: submission.punchline };
}

export function validateSubmission({
  issue,
  submission,
  team,
  schedule,
  archive,
}) {
  const shapeError = validateJokeShape(submission);
  if (shapeError) return { accepted: false, message: shapeError };

  const author = issue?.user?.login;
  const teamMember = team.members.find((member) => member.github === author);
  if (!teamMember) {
    return {
      accepted: false,
      message: "This citizen is not licensed to perform standup comedy.",
    };
  }

  const scheduleEntry = schedule.entries.find(
    (entry) => entry.date === submission.date,
  );
  if (!scheduleEntry) {
    return {
      accepted: false,
      message: "No schedule entry exists for that date.",
    };
  }
  if (scheduleEntry.github !== author) {
    return {
      accepted: false,
      message: "The authenticated GitHub user is not assigned to that date.",
    };
  }
  if (archive.entries.some((entry) => entry.date === submission.date)) {
    return {
      accepted: false,
      message: "A joke has already been filed for this date.",
    };
  }

  const scheduleDates = schedule.entries.map((entry) => entry.date).sort();
  const first = scheduleDates[0];
  const last = scheduleDates.at(-1);
  if (submission.date < first || submission.date > last) {
    return {
      accepted: false,
      message: "The submitted date is outside the configured schedule range.",
    };
  }

  return {
    accepted: true,
    message: "The sacred archive has been updated.",
    teamMember,
  };
}

export function sortArchiveEntries(entries) {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date));
}

export function usedSuggestionIds(archiveEntries, suggestions) {
  const ids = new Set();
  for (const entry of archiveEntries) {
    for (const joke of suggestions) {
      if (joke.type !== entry.type) continue;
      if (joke.type === "single" && joke.text === entry.text) ids.add(joke.id);
      if (
        joke.type === "setup-punchline" &&
        joke.setup === entry.setup &&
        joke.punchline === entry.punchline
      ) {
        ids.add(joke.id);
      }
    }
  }
  return ids;
}

export function unusedSuggestions(archiveEntries, suggestions) {
  const used = usedSuggestionIds(archiveEntries, suggestions);
  const unused = suggestions.filter((joke) => !used.has(joke.id));
  return unused.length > 0 ? unused : suggestions;
}
