# The Office of Interim Comedy

A small static web application for keeping a daily standup joke tradition alive while the usual team joker is away.

## Architecture

Okay brace yourself because this is designed with a very particular goal in mind. Computers are horrible, horrible things and a wise person always seeks to manage as few computers as possible. Since the cloud is just someone else's computer, we can use Github to do a bunch of slightly insane things to build a persistent website without having to manage pesky things like CDNs, or backends or SQL servers.

This project works by hoisting a self mutating repository on Github, effectively each layer in a traditional architecture is replaced by some Github component. The repository exposes a Github page to serve a static frontend. The frontend allows the user to either choose a random joke or select one of their own, traditionally a web server would accept a request from this static page. In this architecture, instead we pipe this directly back to a Github issue describing the joke details. Authentication is performed by piggybacking on Github's identity provider - simply put, you're just using the browser to create an issue. Validation and backend handling are performed by Github actions. Most of the core "backend" logic lives in the scripts folder. CI reads the issues tagged with a label and confirms that the submitter is one of the allow listed users marked in the "database". Which takes us to the last layer - persistence is achieved by just writing to the files contained in the data folder. A git repository is inherently persistent, why try improve on perfection?

Most of this code is built with Github Copilot because I thought it would be funny to also leverage Github tech to write the code. Sadly I ran out of tokens so I had to hand roll some of this like some kind of peasant. So if you go dig into the code, good luck, it's probably the worst combination of LLM and human-possessed-by-madness.

If you've made it this far into the README, congratulations, you now have the intellectual equivalent of a family of racoons living in your hindbrain. I recommend therapy.

## Local Development

Install dependencies:

```sh
npm install
```

Run the app:

```sh
npm run dev
```

Run validation, tests, linting, and production build:

```sh
npm run validate:data
npm test
npm run lint
npm run build
```

Format files:

```sh
npm run format
```

## Configuration

`data/team.json` uses GitHub usernames as authoritative identity:

```json
{
  "members": [
    {
      "github": "alice-gh",
      "name": "Alice"
    }
  ]
}
```
Adding users to this list allows issues submitted by them to contribute to the joke archive. Github users not on this list will have their issue automatically closed and mocked by the automation.


`data/schedule.json` uses explicit dates:

```json
{
  "timezone": "Africa/Johannesburg",
  "entries": [
    {
      "date": "2026-07-27",
      "github": "alice-gh"
    }
  ]
}
```

You can modify this list to alter the schedule or shuffle users around.

`data/archive.json` is written by the Action. It remains sorted by date ascending and permits only one joke per date. This should only be edited when something goes wrong, typically this is entirely managed by the repository itself.


## Contributing

Don't do that. Spend time with your loved ones, learn to cook, pet a seal. I dunno, man, I'm not telling you how to live your life but there's definitely more productive ways to spend your time.

## License

You should learn nothing from this. This is a collection of terrible ideas. If for whatever reason you're driven to derive inspiration from this project, please see the [license](LICENSE.md) before doing so.