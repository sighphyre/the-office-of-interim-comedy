import type { ArchiveEntry, ScheduleEntry, TeamMember } from "./types";

export type ScheduleStatus = "recorded" | "missed" | "today" | "upcoming";

export function findMember(
  members: TeamMember[],
  github: string,
): TeamMember | undefined {
  return members.find((member) => member.github === github);
}

export function findTodayEntry(
  entries: ScheduleEntry[],
  today: string,
): ScheduleEntry | undefined {
  return entries.find((entry) => entry.date === today);
}

export function archiveForDate(
  archive: ArchiveEntry[],
  date: string,
): ArchiveEntry | undefined {
  return archive.find((entry) => entry.date === date);
}

export function scheduleStatus(
  entry: ScheduleEntry,
  today: string,
  archive: ArchiveEntry[],
): ScheduleStatus {
  if (archiveForDate(archive, entry.date)) return "recorded";
  if (entry.date === today) return "today";
  if (entry.date < today) return "missed";
  return "upcoming";
}
