import { RefreshingAuthProvider } from '@twurple/auth';
import { ChatClient } from '@twurple/chat';
import { promises as fs } from 'fs';
import { Util } from './util.mjs';

/**
 * various settings and options and knobs
 * see the file itself; it should have a default value for every
 * available setting
 */
const settings = JSON.parse(await fs.readFile("conf/settings.json", "utf-8"));
/**
 * settings that are a bad idea to put in a public repo
 * contains streamerUsername (your username, string), botUsername (string),
 * clientId (string), clientSecret (string), extremelyStreamUnsafeTerminal
 * (whether auth tokens are printed, boolean) 
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
    if (secrets.extremelyStreamUnsafeTerminal)
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
    console.log(`joined ${channel} as ${user}`);
    const page = Math.ceil(Math.random() * 727);
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
// import code commands last to avoid blocking chat.connect() or something idk
let { codecmds } = await import("./conf/commands.mjs");
// one more thing
process.on("exit", (code) => console.log(`exiting w/ code ${code}`));

/* 
the actual command engines
TODO switch to bun and typescript to make the function signatures not ugly
*/
function prefix(channel, user, text, msg) {
    const [firstword] = text.split(' ', 1); // NO SPACES IN PREFIXES!
    let command = commands.prefix[firstword] // undefined for cmds that don't exist
    if (command && Util.goForLaunch(command, msg)) {
        command.lastUsed = Date.now();
        console.log(`${user} used prefix ${firstword} @ ${new Date(command.lastUsed).toISOString()}`);
        executeCommand(command, channel, user, text, msg);
        return true;
    }
    return false;
}
function infix(channel, user, text, msg) {
    // can't optimize infix and regex like we can w/ prefix
    // no problem, computers are fast
    for (const trigger in commands.infix) {
        let command = commands.infix[trigger];
        if (text.includes(trigger) && Util.goForLaunch(command, msg)) {
            command.lastUsed = Date.now();
            console.log(`${user} used infix ${trigger} @ ${new Date(command.lastUsed).toISOString()}`);
            executeCommand(command, channel, user, text, msg);
            return true;
        }
    }
    return false;
}
function regex(channel, user, text, msg) {
    for (const trigger in commands.regex) {
        let command = commands.regex[trigger];
        let re = new RegExp(trigger, command.flags ?? "su");
        if (re.test(text) && Util.goForLaunch(command, msg)) {
            command.lastUsed = Date.now();
            console.log(`${user} used regex ${trigger} @ ${new Date(command.lastUsed).toISOString()}`);
            executeCommand(command, channel, user, text, msg);
            return true;
        }
    }
    return false;
}
function executeCommand(command, channel, user, text, msg) {
    switch(command.action) {
        case "text":
            chat.say(channel, command.body);
            break;
        case "code":
            try {
                codecmds[command.body](chat, channel, user, text, msg);
            } catch (e) {
                console.error(e);
                chat.say(channel, `@${secrets.streamerUsername} Check the terminal (codecmds.${command.body} frew up)`);
            }
            break;
        case "alias":
            const { type, trigger } = Util.parseAlias(command.body);
            if (!Util.isValidType(type) || !commands[type][trigger]) {
                console.error(`nonexistent alias target ${command.body}`);
                chat.say(channel, `@${secrets.streamerUsername} Check the terminal (${command.body} has to exist for its aliases to work)`);
                break;
            }
            if (commands[type][trigger].action === "alias") { // no recursive aliases
                console.error(`alias target ${command.body} is itself an alias`);
                chat.say(channel, `@${secrets.streamerUsername} Check the terminal (${command.body} is an alias itself and can't have aliases)`);
                break;
            }
            // not setting lastUsed for the alias target is intentional
            console.log(`running aliased ${command.body}`)
            executeCommand(commands[type][trigger], channel, user, text, msg);
            break;
        default:
            console.error(`invalid action ${command.action}`);
            chat.say(channel, `@${secrets.streamerUsername} Check the terminal (${command.action} isn't a valid command action)`);
    }
}
// section: [🏳️‍⚧️.png]
function builtin(channel, user, text, msg) {
    // check prefix match
    if (!text.startsWith(settings.builtin.prefix)) return false;
    // check userlevel
    if (!Util.meetsUserlevel({userlevel: "mod"}, msg.userInfo)) {
        console.log(`${user} tried to use builtin @ ${new Date(Date.now()).toISOString()}`);
        chat.say(channel, `Using ${settings.builtin.prefix} requires mod perms`, {replyTo: msg});
    } else { // userlevel met
        // section: [watermelon pig fruit bowl.jpg]
        const argv = text.split(/\s+/);
        console.log(`${user} used builtin @ ${new Date(Date.now()).toISOString()}. argv[1] is ${argv[1]}`);
        switch (argv[1]) {
            case "cmd":
                // section: [small girly plastic bike for kids.jpg]
                // TODO
                chat.say(channel, `Subcommand cmd not implemented yet; edit conf/commands.json and ${settings.builtin.prefix} reload for now`, {replyTo: msg});
                break;
            case "reload":
                const jsonLoaded = fs.readFile("conf/commands.json", "utf-8").then((val) => {commands = JSON.parse(val);});
                const mjsLoaded = import("./conf/commands.mjs").then((mod) => {codecmds = mod.codecmds;});
                Promise.all([jsonLoaded, mjsLoaded]).then(() => chat.say(channel, "All commands reloaded", {replyTo: msg})).catch((e) => {
                    chat.say(channel, `Reload failed! @${secrets.streamerUsername} Check the terminal and probably restart the bot`, {replyTo: msg});
                    console.error(e);
                }); // do I have to make everything async to write modern js properly?
                break;
            case "shutdown":
                const qaa = () => { // quit after action
                    process.exitCode = 0;
                    chat.quit();
                }
                if (isNaN(parseFloat(argv[2]))) chat.action(channel, "slams shut").then(qaa);
                else setTimeout(() => chat.action(channel, "ceases to glow magenta").then(qaa), parseFloat(argv[2]) * 1000);
                break;
            default: chat.say(channel, `Unrecognized subcommand ${argv[1]}`, {replyTo: msg});
        }
    }
    return true;
}