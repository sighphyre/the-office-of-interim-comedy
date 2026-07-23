#!/usr/bin/env node
import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  buildArchiveEntry,
  parseSubmissionBody,
  readJson,
  sortArchiveEntries,
  validateSubmission,
} from "./joke-core.mjs";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}

const issuePath = args.get("--issue") ?? "issue.json";
const resultPath = args.get("--result") ?? "record-joke-result.json";
const archivePath = args.get("--archive") ?? "data/archive.json";
const teamPath = args.get("--team") ?? "data/team.json";
const schedulePath = args.get("--schedule") ?? "data/schedule.json";

async function writeResult(result) {
  await mkdir(dirname(resolve(resultPath)), { recursive: true });
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);
}

async function writeArchiveAtomic(path, archive) {
  const destination = resolve(path);
  const temp = `${destination}.tmp-${process.pid}`;
  await writeFile(temp, `${JSON.stringify(archive, null, 2)}\n`);
  await rename(temp, destination);
}

try {
  const [issue, team, schedule, archive] = await Promise.all([
    readJson(issuePath),
    readJson(teamPath),
    readJson(schedulePath),
    readJson(archivePath),
  ]);

  const hasDailyJokeLabel = issue.labels?.some(
    (label) => label.name === "daily-joke",
  );
  const hasMarker = String(issue.body ?? "").includes(
    "daily-joke-submission:start",
  );
  if (!hasDailyJokeLabel && !hasMarker) {
    await writeResult({
      accepted: false,
      message: "This issue is not a daily joke submission.",
    });
    process.exit(0);
  }

  const submission = parseSubmissionBody(issue.body);
  const validation = validateSubmission({
    issue,
    submission,
    team,
    schedule,
    archive,
  });
  if (!validation.accepted) {
    await writeResult({ ...validation, date: submission.date ?? null });
    process.exit(0);
  }

  const entry = buildArchiveEntry({
    submission,
    issue,
    teamMember: validation.teamMember,
  });
  const updatedArchive = {
    entries: sortArchiveEntries([...archive.entries, entry]),
  };
  await writeArchiveAtomic(archivePath, updatedArchive);
  await writeResult({
    accepted: true,
    message: validation.message,
    date: submission.date,
    issueNumber: issue.number,
  });
} catch (error) {
  await writeResult({
    accepted: false,
    message: error instanceof Error ? error.message : String(error),
  });
  process.exit(0);
}
