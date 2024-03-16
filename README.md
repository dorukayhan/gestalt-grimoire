# Gestalt Grimoire

Here's yet another chat command engine for Twitch. It exists solely because I couldn't be bothered to learn [advanced Nightbot sorcery](https://docs.nightbot.tv/commands/variableslist).

<sup>It also makes for nice "I know server-side JS!" cred.</sup>

## Usage

Note that this thing's development is "it works on my machine"-driven and may or may not work on yours. Make sure you at least have your favorite JS runtime's latest version I guess?

### Installing and running

1. `git clone git@github.com:dorukayhan/gestalt-grimoire.git && cd gestalt-grimoire && npm install || yarn install || pnpm install || bun install --no-save`
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
6. `mkdir conf/cmdstate`

Then run grimoire.mjs. The bot should join your chat and "glow magenta and open to page [random number between 1 and 727]" if everything is set up correctly.  
**Be sure to not show the terminal on stream!**

### Commands

Gestalt Grimoire has three types of commands, differing in how they're checked against incoming messages:

- **Prefixes** must be at the start of the message
    - Spaces aren't allowed and the initial ! or $ or whatever has to be included, like Nightbot
    - Case-sensitive, unlike Nightbot
    - `!grimoire` (or whatever you set `builtin.prefix` to in conf/settings.json) is the **built-in** for stuff like adding/removing commands and gets special treatment (e.g. you can't override it with a prefix of the same name)
- **Infixes** can be anywhere in the message
    - Also case-sensitive
- **Regexes** are regular expressions (duh) that must match the message
    - [JS regex rules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions) apply (Copy of duh)
    - `s` and `u` flags apply by default

(Regexes alone would be enough, of course, but then there wouldn't be a way to generate a readable command list.)

The built-in is checked first, then prefixes, then infixes, then regexes, and the first command that matches is executed. For instance:

- if a message matches a prefix, an infix, and a regex at the same time, the prefix runs
- if your built-in is `!grimoire` and you (for some reason) add a prefix named `!grimoire`, the prefix will never run
- if a message matches three infixes and a regex, the infix that appears first in conf/commands.json runs

All commands are kept in conf/commands.json, inside the appropriate one of the `prefix`, `infix`, and `regex` objects, which function as maps where the keys are commands and the values are each command's properties. The said properties are:

- `action` (what the command does - `text`, `code`, or `alias`)
- `body` (if `type` is `text`, string to post in chat; if it's `code`, name of function in conf/commands.mjs to execute; if it's `alias`, another command to execute in the form `(prefix|infix|regex) [command]`)
- `userlevel` (minimum chat privileges required to use the command - `streamer`, `mod`, or `everyone`)
- `cooldown` in seconds
- `enabled` (whether the command works at all - true or false)
- `flags` for regexes (flags to use, e.g. `siu` gives a case-insensitive regex)

#### Built-in commands

The built-in is a prefix that contains subcommands for managing the bot. The syntax is `[built-in] [subcommand] [subcommand args]` (e.g. `!grimoire cmd add prefix !xd xdd`), everything is case-sensitive, and the following subcommands are available:

- `cmd` manages commands (no shit Omanyte). `type` must be one of `prefix`/`infix`/`regex`
    - `cmd [add/edit] [type] [command] [body]` adds/edits text commands. `command` can't contain spaces, and new commands use the default `userlevel` and `cooldown` from `builtin.cmd` in conf/settings.json
    - `cmd alias [type] [command] [body]` adds/edits aliases. Same details as `cmd [add/edit]` apply
    - `cmd set [type] [command] [userlevel/cooldown/cd/enabled/flags] [value]` edits command properties (`cd` is short for `cooldown`)
    - `cmd [delete/remove] [type] [command]` deletes commands. Deleting a code command won't remove its function from conf/commands.mjs!
- `reload` reloads conf/commands.json and conf/commands.mjs. This can be used for changing a bunch of stuff all at once and is the only way to add/edit code commands without restarting the bot
- `shutdown [seconds]` does exactly what it says. The bot "ceases to glow magenta" after `seconds` seconds, or "slams shut" immediately if `seconds` isn't given

The built-in is always enabled, can only be used by mods and the streamer, and has no cooldown.

### Arbitrary code execution

You can put code in conf/commands.mjs to be executed via commands.  
If this makes your inner infosec whiz scream in horror, good. If not, **remember to not put anything in them that you don't FULLY understand!**

(hint: if it touches conf/tokens.json _at all_ or calls any `chat` method other than `say()` and `action()`, it's malware; only grimoire.mjs should be doing those)

#### Code commands

Every command whose `action` is `code` names a conf/commands.mjs function in its `body`. This function should have the following parameters in order:

- `chat` (send messages using `chat.say()` and `chat.action()`)
- `channel` (streamer's username, needed for `say()` and `action()`)
- `user` (username of chatter who used the command)
- `text` (message that triggered the command)
- `msg` ([aforementioned message's metadata](https://twurple.js.org/reference/chat/classes/ChatMessage.html))

Avoid defining variables outside of functions in commands.mjs - `[built-in] reload` may break things otherwise. If your command needs state (e.g. a counter), put it in a file in conf/cmdstate and load it anew every time the command is used (like a browser cookie!).