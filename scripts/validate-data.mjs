#!/usr/bin/env node
import {
  readJson,
  isValidDateString,
  validateJokeShape,
} from "./joke-core.mjs";

const errors = [];
const unique = (items, label) => {
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item)) errors.push(`Duplicate ${label}: ${item}`);
    seen.add(item);
  }
};

const validGithub = (value) =>
  /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(value);

function validateArchiveEntry(entry, index, teamMembers) {
  if (!isValidDateString(entry.date ?? ""))
    errors.push(`Archive entry ${index} has an invalid date.`);
  if (!teamMembers.has(entry.github))
    errors.push(`Archive member not in team: ${entry.github}`);
  const shapeError = validateJokeShape({ ...entry, version: "1" });
  if (shapeError)
    errors.push(`Archive entry ${entry.date ?? index}: ${shapeError}`);
  if (!Number.isInteger(entry.issueNumber)) {
    errors.push(
      `Archive entry ${entry.date ?? index} is missing an integer issueNumber.`,
    );
  }
}

const [team, schedule, archive] = await Promise.all([
  readJson("data/team.json"),
  readJson("data/schedule.json"),
  readJson("data/archive.json"),
]);

if (!Array.isArray(team.members))
  errors.push("team.json must contain a members array.");
if (!Array.isArray(schedule.entries))
  errors.push("schedule.json must contain an entries array.");
if (!Array.isArray(archive.entries))
  errors.push("archive.json must contain an entries array.");

const teamMembers = new Set(team.members.map((member) => member.github));
unique([...teamMembers], "team GitHub username");
for (const member of team.members) {
  if (!validGithub(member.github))
    errors.push(`Invalid GitHub username: ${member.github}`);
  if (!member.name)
    errors.push(`Team member ${member.github} is missing a display name.`);
}

unique(
  schedule.entries.map((entry) => entry.date),
  "schedule date",
);
for (const entry of schedule.entries) {
  if (!isValidDateString(entry.date))
    errors.push(`Invalid schedule date: ${entry.date}`);
  if (!teamMembers.has(entry.github))
    errors.push(`Schedule member not in team: ${entry.github}`);
}

unique(
  archive.entries.map((entry) => entry.date),
  "archive date",
);
archive.entries.forEach((entry, index) =>
  validateArchiveEntry(entry, index, teamMembers),
);

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log("Data validation passed.");
