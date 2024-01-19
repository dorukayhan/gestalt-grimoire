# Gestalt Grimoire

Here's yet another chat command engine for Twitch. It exists solely because I couldn't be bothered to learn [advanced Nightbot sorcery](https://docs.nightbot.tv/commands/variableslist)'.

<sup>It also makes for nice "I know JS of the Node variety!" cred.</sup>

## Usage

Note that this thing's development is "it works on my machine"-driven and may or may not work on yours. Make sure you at least have [the latest Node.js Current](https://nodejs.org/dist/latest/) I guess?

### Installing and running

1. `git clone git@github.com:dorukayhan/gestalt-grimoire.git && cd gestalt-grimoire && npm install`
2. Create an account for the bot and make it a mod in your chat
2. Follow the [Twurple bot example](https://twurple.js.org/docs/examples/chat/basic-bot.html)'s instructions to get an access token. Use `http://localhost` as the redirect URI, `chat:read+chat:edit+channel:moderate` as the scope, and `curl -X POST https://id.twitch.tv/oauth2/token?client_id=FILL_IN&client_secret=FILL_IN&code=YEP&grant_type=authorization_code&redirect_uri=http%3A%2F%2Flocalhost` for the part of the OAuth flow that requires leaving your browser
3. Put the token in conf/tokens.json like so:
    ```
    {
        "accessToken": "???",
        "refreshToken": "???",
        "expiresIn": 0,
        "obtainmentTimestamp": 0
    }
    ```
4. Read the comments in grimoire.mjs and fill out conf/settings.json and conf/secrets.json accordingly
5. `node grimoire.mjs`

If everything works, the bot should "glow magenta and open to page [random number between 1 and 1000]".