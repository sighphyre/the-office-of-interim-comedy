import { useMemo, useState } from "react";
import archiveData from "../data/archive.json";
import scheduleData from "../data/schedule.json";
import suggestionsData from "../data/suggestions.json";
import teamData from "../data/team.json";
import { formatDisplayDate, todayInTimezone } from "./lib/dates";
import { repository } from "./lib/config";
import { buildIssueUrl, repositoryConfigured } from "./lib/submission";
import {
  archiveForDate,
  findMember,
  findTodayEntry,
  scheduleStatus,
} from "./lib/schedule";
import { filterUnusedSuggestions, pickSuggestion } from "./lib/jokes";
import type { ArchiveEntry, Joke } from "./lib/types";

const textLimit = 500;
const setupLimit = 300;
const punchlineLimit = 300;

function renderJoke(joke: Joke) {
  if (joke.type === "single") return <p>{joke.text}</p>;
  return (
    <>
      <p className="setup">{joke.setup}</p>
      <p className="punchline">{joke.punchline}</p>
    </>
  );
}

function App() {
  const today = todayInTimezone(scheduleData.timezone);
  const todayEntry = findTodayEntry(scheduleData.entries, today);
  const todayMember = todayEntry
    ? findMember(teamData.members, todayEntry.github)
    : undefined;
  const todayArchive = archiveForDate(
    archiveData.entries as ArchiveEntry[],
    today,
  );
  const candidates = useMemo(
    () =>
      filterUnusedSuggestions(
        archiveData.entries as ArchiveEntry[],
        suggestionsData.jokes as Joke[],
      ),
    [],
  );
  const [suggestion, setSuggestion] = useState<Joke>(() =>
    pickSuggestion(candidates),
  );
  const [selectedJoke, setSelectedJoke] = useState<Joke>(suggestion);
  const [customMode, setCustomMode] = useState<"single" | "setup-punchline">(
    "single",
  );
  const [customText, setCustomText] = useState("");
  const [customSetup, setCustomSetup] = useState("");
  const [customPunchline, setCustomPunchline] = useState("");
  const [formError, setFormError] = useState("");

  const selectCustom = () => {
    const joke: Joke =
      customMode === "single"
        ? { type: "single", text: customText.trim() }
        : {
            type: "setup-punchline",
            setup: customSetup.trim(),
            punchline: customPunchline.trim(),
          };
    if (joke.type === "single" && !joke.text) {
      setFormError("The one-line joke is required.");
      return;
    }
    if (joke.type === "setup-punchline" && (!joke.setup || !joke.punchline)) {
      setFormError("Both setup and punchline are required.");
      return;
    }
    setFormError("");
    setSelectedJoke(joke);
  };

  const giveAnother = () => {
    const next = pickSuggestion(candidates, suggestion.id);
    setSuggestion(next);
    setSelectedJoke(next);
  };

  const canSubmit = todayEntry && !todayArchive && repositoryConfigured();
  const issueUrl = todayEntry ? buildIssueUrl(today, selectedJoke) : "";

  return (
    <div className="app">
      <header className="site-header">
        <div>
          <p className="eyebrow">
            Department of Joke Continuity and Standup Morale
          </p>
          <h1>The Office of Interim Comedy</h1>
        </div>
        <nav aria-label="Page sections">
          <a href="#today">Today</a>
          <a href="#schedule">Schedule</a>
          <a href="#archive">Archive</a>
        </nav>
      </header>

      <main>
        <section
          id="today"
          className="today-panel"
          aria-labelledby="today-heading"
        >
          <div>
            <p className="eyebrow">{formatDisplayDate(today)}</p>
            <h2 id="today-heading">Today&apos;s Temporary Jester</h2>
            {todayEntry && todayMember ? (
              <>
                <p className="jester-name">{todayMember.name}</p>
                <p className="status">
                  {todayArchive
                    ? `${todayMember.name} has fulfilled their statutory comedy obligation.`
                    : "Status: The joke remains tragically unrecorded."}
                </p>
              </>
            ) : (
              <p className="status">
                No temporary jester has been appointed today. Bureaucracy has
                failed us.
              </p>
            )}
          </div>
          <div className="stamp" aria-hidden="true">
            {todayArchive ? "Filed" : "Pending"}
          </div>
        </section>

        <section className="workbench" aria-label="Joke submission desk">
          <div className="panel">
            <h2>Suggested Joke</h2>
            <div className="joke-box">{renderJoke(suggestion)}</div>
            <div className="button-row">
              <button type="button" onClick={giveAnother}>
                Give me another
              </button>
              <button type="button" onClick={() => setSelectedJoke(suggestion)}>
                Select this suggestion
              </button>
            </div>
          </div>

          <div className="panel">
            <h2>Custom Joke</h2>
            <div className="tabs" role="tablist" aria-label="Custom joke type">
              <button
                type="button"
                className={customMode === "single" ? "active" : ""}
                onClick={() => setCustomMode("single")}
              >
                One-line
              </button>
              <button
                type="button"
                className={customMode === "setup-punchline" ? "active" : ""}
                onClick={() => setCustomMode("setup-punchline")}
              >
                Setup and punchline
              </button>
            </div>

            {customMode === "single" ? (
              <label>
                One-line joke
                <textarea
                  maxLength={textLimit}
                  value={customText}
                  onChange={(event) => setCustomText(event.target.value)}
                  aria-describedby="text-count"
                />
                <span id="text-count" className="counter">
                  {customText.length}/{textLimit}
                </span>
              </label>
            ) : (
              <div className="field-grid">
                <label>
                  Setup
                  <textarea
                    maxLength={setupLimit}
                    value={customSetup}
                    onChange={(event) => setCustomSetup(event.target.value)}
                    aria-describedby="setup-count"
                  />
                  <span id="setup-count" className="counter">
                    {customSetup.length}/{setupLimit}
                  </span>
                </label>
                <label>
                  Punchline
                  <textarea
                    maxLength={punchlineLimit}
                    value={customPunchline}
                    onChange={(event) => setCustomPunchline(event.target.value)}
                    aria-describedby="punchline-count"
                  />
                  <span id="punchline-count" className="counter">
                    {customPunchline.length}/{punchlineLimit}
                  </span>
                </label>
              </div>
            )}
            {formError ? (
              <p className="error" role="alert">
                {formError}
              </p>
            ) : null}
            <button type="button" onClick={selectCustom}>
              Select custom joke
            </button>
          </div>

          <div className="panel submission-panel">
            <h2>Selected Filing</h2>
            <div className="joke-box selected">{renderJoke(selectedJoke)}</div>
            {!repositoryConfigured() ? (
              <p className="error">
                Replace the repository placeholders in{" "}
                <code>src/lib/config.ts</code> before submissions can open the
                correct GitHub issue page.
              </p>
            ) : null}
            <p className="note">
              GitHub will open in a new page. Submit the issue there to complete
              the official filing.
            </p>
            <a
              className={`submit-link ${canSubmit ? "" : "disabled"}`}
              href={canSubmit ? issueUrl : undefined}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!canSubmit}
            >
              This is my joke for the day
            </a>
          </div>
        </section>

        <section
          id="schedule"
          className="section"
          aria-labelledby="schedule-heading"
        >
          <h2 id="schedule-heading">Upcoming Schedule</h2>
          <div className="schedule-list">
            {scheduleData.entries.map((entry) => {
              const member = findMember(teamData.members, entry.github);
              const status = scheduleStatus(
                entry,
                today,
                archiveData.entries as ArchiveEntry[],
              );
              const label = {
                recorded: "Recorded",
                missed: "Failed the department",
                today: "Today",
                upcoming: "Upcoming",
              }[status];
              return (
                <div className="schedule-row" key={entry.date}>
                  <span>{formatDisplayDate(entry.date)}</span>
                  <strong>{member?.name ?? entry.github}</strong>
                  <span className={`pill ${status}`}>{label}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section
          id="archive"
          className="section archive-section"
          aria-labelledby="archive-heading"
        >
          <div className="section-title-row">
            <h2 id="archive-heading">
              The Collected Works of the Temporary Jesters
            </h2>
            <button type="button" onClick={() => window.print()}>
              Print archive
            </button>
          </div>
          <div className="archive-list">
            {(archiveData.entries as ArchiveEntry[]).map((entry) => (
              <article className="archive-entry" key={entry.date}>
                <header>
                  <div>
                    <p className="eyebrow">{formatDisplayDate(entry.date)}</p>
                    <h3>{entry.name}</h3>
                  </div>
                  {repositoryConfigured() ? (
                    <a
                      href={`https://github.com/${repository.owner}/${repository.name}/issues/${entry.issueNumber}`}
                    >
                      Issue #{entry.issueNumber}
                    </a>
                  ) : (
                    <span>Issue #{entry.issueNumber}</span>
                  )}
                </header>
                <div className="joke-box">{renderJoke(entry)}</div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
