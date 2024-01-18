# Gestalt Grimoire

Here's yet another chat command engine for Twitch. It exists solely because I couldn't be bothered to learn [advanced Nightbot sorcery](https://docs.nightbot.tv/commands/variableslist)'.

<sup><sup>It also makes for nice "I know JS of the Node.js variety!" cred.</sup></sup>

## Usage

Note that this thing's development is "it works on my machine"-driven and may or may not work on yours. Make sure you at least have [the latest Node.js Current](https://nodejs.org/dist/latest/) I guess?

### Installing and running

    git clone git@github.com:dorukayhan/gestalt-grimoire.git
    cd gestalt-grimoire
    npm install
    node grimoire.mjs

This should immediately crash with a "where OAuth credentials?". Once that happens, [go set up authentication](https://dev.twitch.tv/docs/authentication/).

[TODO what happens on successful run]