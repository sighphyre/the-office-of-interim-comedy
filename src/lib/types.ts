export type Joke =
  | {
      id?: string;
      type: "single";
      text: string;
    }
  | {
      id?: string;
      type: "setup-punchline";
      setup: string;
      punchline: string;
    };

export type TeamMember = {
  github: string;
  name: string;
};

export type ScheduleEntry = {
  date: string;
  github: string;
};

export type ArchiveEntry = Joke & {
  date: string;
  github: string;
  name: string;
  issueNumber: number;
  recordedAt: string;
};
