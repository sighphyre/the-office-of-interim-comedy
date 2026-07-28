import { issueLabel, repository } from "./config";
import type { Joke } from "./types";

export function buildIssueBody(
  date: string,
  joke: Joke,
  nextGithub?: string,
): string {
  const jokeSection =
    joke.type === "single"
      ? `### Text\n\n${joke.text}`
      : `### Setup\n\n${joke.setup}\n\n### Punchline\n\n${joke.punchline}`;
  const nextJesterLine = nextGithub
    ? `<!-- next-github:${nextGithub} -->\n`
    : "";

  return `## Daily joke submission

**Date:** ${date}
**Format version:** 2
**Joke type:** ${joke.type}
${nextGithub ? `**Next temporary jester:** ${nextGithub}\n` : ""}

<!-- daily-joke-submission:start -->
<!-- version:2 -->
<!-- date:${date} -->
<!-- type:${joke.type} -->
${nextJesterLine}

${jokeSection}

<!-- daily-joke-submission:end -->
`;
}

export function buildIssueUrl(
  date: string,
  joke: Joke,
  nextGithub?: string,
): string {
  const params = new URLSearchParams({
    title: `Daily joke: ${date}`,
    labels: issueLabel,
    body: buildIssueBody(date, joke, nextGithub),
  });
  return `https://github.com/${repository.owner}/${repository.name}/issues/new?${params.toString()}`;
}
