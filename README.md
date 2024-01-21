# Gestalt Grimoire

Here's yet another chat command engine for Twitch. It exists solely because I couldn't be bothered to learn [advanced Nightbot sorcery](https://docs.nightbot.tv/commands/variableslist).

<sup>It also makes for nice "I know JS of the Node variety!" cred.</sup>

## Usage

Note that this thing's development is "it works on my machine"-driven and may or may not work on yours. Make sure you at least have [the latest Node.js Current](https://nodejs.org/dist/latest/) I guess?

### Installing and running

1. `git clone git@github.com:dorukayhan/gestalt-grimoire.git && cd gestalt-grimoire && npm install`
2. Create an account for the bot and make it a mod in your chat
3. Follow the [Twurple bot example](https://twurple.js.org/docs/examples/chat/basic-bot.html)'s instructions to get an access token. Use `http://localhost` as the redirect URI, `chat:read+chat:edit+channel:moderate` as the scope, and `curl -X POST https://id.twitch.tv/oauth2/token?client_id=FILL_IN&client_secret=FILL_IN&code=YEP&grant_type=authorization_code&redirect_uri=http%3A%2F%2Flocalhost` for the part of the OAuth flow that requires leaving your browser
4. Put the token in conf/tokens.json like so:
    ```
    {
        "accessToken": "???",
        "refreshToken": "???",
        "expiresIn": 0,
        "obtainmentTimestamp": 0
    }
    ```
5. Read the comments in grimoire.mjs and fill out conf/settings.json and conf/secrets.json accordingly
6. `node grimoire.mjs`

If everything works, the bot should "glow magenta and open to page [random number between 1 and 1000]".

### Commands

Gestalt Grimoire has three types of commands, differing in how they're checked against incoming messages:

- **Prefixes** must be at the start of the message
    - There's no global prefix (so you have to include the ! or whatever in your prefixes) and spaces aren't allowed, like Nightbot
    - Case-sensitive, unlike Nightbot
    - `!grimoire` (or whatever you set `builtin` to in conf/settings.json) is the **built-in** for stuff like adding/removing commands and restarting the bot and gets special treatment (e.g. you can't override it with a prefix of the same name)
- **Infixes** can be anywhere in the message
    - Also case-sensitive
- **Regexes** are regular expressions (duh) that must match the message
    - [JavaScript regex rules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions) apply (Copy of duh)
    - `s` and `u` flags apply by default

The built-in is checked first, then prefixes, then infixes, then regexes, and the first command that matches is executed. For instance:

- if a message matches a prefix, an infix, and a regex at the same time, the prefix runs
- if your built-in is `!grimoire` and you (for some reason) add a prefix named `!grimoire`, the prefix will never run
- if a message matches three infixes and a regex, the infix that appears first in conf/commands.json runs

All commands are kept in conf/commands.json, inside the appropriate one of the `prefix`, `infix`, and `regex` objects, which function as maps where the keys are commands and the values are each command's properties. The said properties are:

- `type` (what the command does - `"text"`, `"code"`, or `"alias"`)
- `body` (if `type` is `text`, string to post in chat; if it's `code`, name of function in conf/commands.mjs to execute and post its return value in chat; if it's `alias`, another command to execute in the form `(prefix|infix|regex) [command]`)
- `userlevel` (minimum chat privileges required to use the command - `"streamer"`, `"mod"`, or `"everyone"`)
- `cooldown` in seconds
- `enabled` (whether the command works at all - `true` or `false`)
- `flags` for regexes (flags to use, e.g. `siu` gives a case-insensitive regex)

#### More on code commands

[TODO explain commands.mjs "ABI"]