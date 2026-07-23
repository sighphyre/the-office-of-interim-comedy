import { issueLabel, repository } from "./config";
import type { Joke } from "./types";

export function buildIssueBody(date: string, joke: Joke): string {
  const jokeSection =
    joke.type === "single"
      ? `### Text\n\n${joke.text}`
      : `### Setup\n\n${joke.setup}\n\n### Punchline\n\n${joke.punchline}`;

  return `## Daily joke submission

**Date:** ${date}
**Format version:** 1
**Joke type:** ${joke.type}

<!-- daily-joke-submission:start -->
<!-- version:1 -->
<!-- date:${date} -->
<!-- type:${joke.type} -->

${jokeSection}

<!-- daily-joke-submission:end -->
`;
}

export function buildIssueUrl(date: string, joke: Joke): string {
  const params = new URLSearchParams({
    title: `Daily joke: ${date}`,
    labels: issueLabel,
    body: buildIssueBody(date, joke),
  });
  return `https://github.com/${repository.owner}/${repository.name}/issues/new?${params.toString()}`;
}
