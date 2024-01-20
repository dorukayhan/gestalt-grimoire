import { RefreshingAuthProvider } from '@twurple/auth';
import { ChatClient } from '@twurple/chat';
import { promises as fs } from 'fs';
import { Util } from './util.mjs';

/**
 * various settings and options and knobs
 * contains builtinCommand ("prefix" for builtins like editing commands and
 * restarting/shutting down, string)
 */
const settings = JSON.parse(await fs.readFile("conf/settings.json", "utf-8"));
/**
 * settings that are a bad idea to put in a public repo
 * contains streamerUsername (your username, string), botUsername (string),
 * clientId (string), clientSecret (string), streamSafeTerminal
 * (whether the terminal is safe to show on stream, boolean, see auth.onRefresh)
 */
const secrets = JSON.parse(await fs.readFile("conf/secrets.json", "utf-8"));
/**
 * access and refresh tokens
 * see step 7 of https://twurple.js.org/docs/examples/chat/basic-bot.html
 */
const tokens = JSON.parse(await fs.readFile("conf/tokens.json", "utf-8"));
/**
 * commands
 * see README
 */
let commands = JSON.parse(await fs.readFile("conf/commands.json", "utf-8"));
const auth = new RefreshingAuthProvider({
    clientId: secrets.clientId,
    clientSecret: secrets.clientSecret
});
// set up auth
auth.onRefresh(async (userId, newToken) => {
    console.log("refreshing access token, check tokens.json");
    if (!(secrets.streamSafeTerminal ?? true))
        console.log(JSON.stringify(newToken)); // in case writeFile fails
    await fs.writeFile("conf/tokens.json", JSON.stringify(newToken, null, 4), "utf-8");
});
await auth.addUserForToken(tokens, ["chat"]);
// set up chat connection
const chat = new ChatClient({
    authProvider: auth,
    channels: [secrets.streamerUsername],
    isAlwaysMod: true,
    requestMembershipEvents: false // only trigger onJoin on bot joining
});
chat.onJoin((channel, user) => {
    console.log(`joined ${channel}`);
    const page = Math.ceil(Math.random() * 1000);
    chat.action(channel, `glows magenta and opens to page ${page}`);
});
chat.onMessage((channel, user, text, msg) => {
    if (user.toLowerCase() !== secrets.botUsername.toLowerCase()) {
        // check for prefix cmds, then check for infix cmds,
        // then check for regex cmds
        if (builtin(channel, user, text, msg));
        else if (prefix(channel, user, text, msg));
        else if (infix(channel, user, text, msg));
        else if (regex(channel, user, text, msg));
    }
});

chat.connect();

/* 
the actual command engines
this would get ugly without type annotations. I do NOT want to
deal with transpiling typescript and bun is getting a windows
release soon (https://twitter.com/bunjavascript/status/1747073096295874990),
so I should just wait until then to develop the bot further
*/
function builtin(channel, user, text, msg) {
    return false; // TODO
}
function prefix(channel, user, text, msg) {
    const firstword = text.split(' ', 1)[0];
    let command = commands.prefix[firstword] // undefined for cmds that don't exist
    if (command && command.enabled && Util.commandNotOnCD(command)) {
        // TODO add userlevel check
        command.lastUsed = Date.now();
        console.log(`${user} used prefix ${firstword} @ ${new Date(command.lastUsed).toISOString()}`);
        executeCommand(command, channel, user, text, msg);
        return true;
    }
    return false;
}
function infix(channel, user, text, msg) {
    return false; // TODO
}
function regex(channel, user, text, msg) {
    return false; // TODO
}
function executeCommand(command, channel, user, text, msg) {
    switch(command.type) {
        case "text":
            chat.say(channel, command.body);
            break;
        default:
            chat.say(channel, "Non-text commands not implemented yet");
    }
}