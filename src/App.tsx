import { useEffect, useMemo, useState } from "react";
import archiveData from "../data/archive.json";
import scheduleData from "../data/schedule.json";
import suggestionsData from "../data/suggestions.json";
import teamData from "../data/team.json";
import { formatDisplayDate, todayInTimezone } from "./lib/dates";
import { repository } from "./lib/config";
import { buildIssueUrl } from "./lib/submission";
import {
  archiveForDate,
  findMember,
  findTodayEntry,
  scheduleStatus,
} from "./lib/schedule";
import { filterUnusedSuggestions, pickSuggestion } from "./lib/jokes";
import type { ArchiveEntry, Joke } from "./lib/types";

const textLimit = 500;
type View = "today" | "schedule" | "archive";

function viewFromHash(): View {
  const hash = window.location.hash.replace("#", "");
  return hash === "schedule" || hash === "archive" ? hash : "today";
}

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
  const [view, setView] = useState<View>(() => viewFromHash());
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
  const [customText, setCustomText] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const syncHash = () => setView(viewFromHash());
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const chooseView = (nextView: View) => {
    setView(nextView);
    window.history.replaceState(null, "", `#${nextView}`);
  };

  const selectCustom = () => {
    const joke: Joke = { type: "single", text: customText.trim() };
    if (!joke.text) {
      setFormError("The one-line joke is required.");
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

  const canSubmit = Boolean(todayEntry && !todayArchive);
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
          <a
            className={view === "today" ? "active" : ""}
            href="#today"
            onClick={() => chooseView("today")}
          >
            Today
          </a>
          <a
            className={view === "schedule" ? "active" : ""}
            href="#schedule"
            onClick={() => chooseView("schedule")}
          >
            Schedule
          </a>
          <a
            className={view === "archive" ? "active" : ""}
            href="#archive"
            onClick={() => chooseView("archive")}
          >
            Archive
          </a>
        </nav>
      </header>

      <main>
        {view === "today" ? (
          <section id="today" className="view" aria-labelledby="today-heading">
            <div className="today-panel">
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
                    No temporary jester has been appointed today. Bureaucracy
                    has failed us.
                  </p>
                )}
              </div>
              <div className="stamp" aria-hidden="true">
                {todayArchive ? "Filed" : "Pending"}
              </div>
            </div>

            <div className="workbench" aria-label="Joke submission desk">
              <div className="panel">
                <h2>Suggested Joke</h2>
                <div className="joke-box">{renderJoke(suggestion)}</div>
                <div className="button-row">
                  <button type="button" onClick={giveAnother}>
                    Give me another
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedJoke(suggestion)}
                  >
                    Select this suggestion
                  </button>
                </div>
              </div>

              <div className="panel submission-panel">
                <h2>Selected Filing</h2>
                <div className="joke-box selected">
                  {renderJoke(selectedJoke)}
                </div>
                <div className="custom-inline">
                  <h3>Custom one-liner</h3>
                  <p className="note">
                    Optional. Select it below before filing.
                  </p>
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
                  {formError ? (
                    <p className="error" role="alert">
                      {formError}
                    </p>
                  ) : null}
                  <button type="button" onClick={selectCustom}>
                    Select custom joke
                  </button>
                </div>
                <p className="note">
                  GitHub will open in a new page. Submit the issue there to
                  complete the official filing.
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
            </div>
          </section>
        ) : null}

        {view === "schedule" ? (
          <section
            id="schedule"
            className="section view"
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
        ) : null}

        {view === "archive" ? (
          <section
            id="archive"
            className="section archive-section view"
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
                    <a
                      href={`https://github.com/${repository.owner}/${repository.name}/issues/${entry.issueNumber}`}
                    >
                      Issue #{entry.issueNumber}
                    </a>
                  </header>
                  <div className="joke-box">{renderJoke(entry)}</div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

export default App;
