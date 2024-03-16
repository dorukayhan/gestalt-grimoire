import { RefreshingAuthProvider } from '@twurple/auth';
import { ChatClient } from '@twurple/chat';
import { promises as fs } from 'fs';
import { Util } from './util.mjs';

/**
 * various settings and options and knobs
 * see the file itself; it should have a default value for every
 * available setting
 */
const SETTINGS = JSON.parse(await fs.readFile(Util.settingsPath, "utf-8"));
/**
 * settings that are a bad idea to put in a public repo
 * contains streamerUsername (your username, string), botUsername (string),
 * clientId (string), clientSecret (string), extremelyStreamUnsafeTerminal
 * (whether auth tokens are printed, boolean) 
 */
const SECRETS = JSON.parse(await fs.readFile(Util.secretsPath, "utf-8"));
/**
 * access and refresh tokens
 * see step 7 of https://twurple.js.org/docs/examples/chat/basic-bot.html
 */
const TOKENS = JSON.parse(await fs.readFile(Util.tokensPath, "utf-8"));
/**
 * commands
 * see README
 */
let COMMANDS = JSON.parse(await fs.readFile(Util.commandsPath, "utf-8"));
const auth = new RefreshingAuthProvider({
    clientId: SECRETS.clientId,
    clientSecret: SECRETS.clientSecret
});
// set up auth
auth.onRefresh(async (userId, newToken) => {
    console.log("refreshing access token, check tokens.json");
    if (SECRETS.extremelyStreamUnsafeTerminal)
        console.log(JSON.stringify(newToken)); // in case writeFile fails
    await fs.writeFile(Util.tokensPath, JSON.stringify(newToken, null, 4), "utf-8");
});
await auth.addUserForToken(TOKENS, ["chat"]);
// set up chat connection
const chat = new ChatClient({
    authProvider: auth,
    channels: [SECRETS.streamerUsername],
    isAlwaysMod: true,
    requestMembershipEvents: false // only trigger onJoin on bot joining
});
chat.onJoin((channel, user) => {
    console.log(`joined ${channel} as ${user}`);
    const page = Math.ceil(Math.random() * 727);
    chat.action(channel, `glows magenta and opens to page ${page}`);
});
chat.onMessage((channel, user, text, msg) => {
    if (user.toLowerCase() !== SECRETS.botUsername.toLowerCase()) {
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
let { codecmds } = await import(Util.codecmdsPath);
// one more thing
process.on("exit", (code) => console.log(`exiting w/ code ${code}`));

/* 
the actual command engines
TODO switch to bun and typescript to make the function signatures not ugly
*/
function prefix(channel, user, text, msg) {
    const [firstword] = text.split(' ', 1); // NO SPACES IN PREFIXES!
    let command = COMMANDS.prefix[firstword] // undefined for cmds that don't exist
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
    for (const trigger in COMMANDS.infix) {
        let command = COMMANDS.infix[trigger];
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
    for (const trigger in COMMANDS.regex) {
        let command = COMMANDS.regex[trigger];
        let re;
        try {
            re = new RegExp(trigger, command.flags ?? "su");
        } catch (e) {
            console.error(e);
            console.error(`regex ${trigger} is broken! see above!`);
            chat.say(channel, `@${SECRETS.streamerUsername} Check the terminal (regex ${trigger} doesn't compile)`);
            // if there's a broken regex the bot will flood the chat about it xdd
            return true;
        }
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
                chat.say(channel, `@${SECRETS.streamerUsername} Check the terminal (codecmds.${command.body} frew up)`);
            }
            break;
        case "alias":
            const { type, trigger } = Util.parseAlias(command.body);
            if (!Util.isValidType(type) || !COMMANDS[type][trigger]) {
                console.error(`nonexistent alias target ${command.body}`);
                chat.say(channel, `@${SECRETS.streamerUsername} Check the terminal (${command.body} has to exist for its aliases to work)`);
                break;
            }
            if (COMMANDS[type][trigger].action === "alias") { // no recursive aliases
                console.error(`alias target ${command.body} is itself an alias`);
                chat.say(channel, `@${SECRETS.streamerUsername} Check the terminal (${command.body} is an alias itself and can't have aliases)`);
                break;
            }
            // not setting lastUsed for the alias target is intentional
            console.log(`running aliased ${command.body}`)
            executeCommand(COMMANDS[type][trigger], channel, user, text, msg);
            break;
        default:
            console.error(`invalid action ${command.action}`);
            chat.say(channel, `@${SECRETS.streamerUsername} Check the terminal (${command.action} isn't a valid command action)`);
    }
}
// section: [🏳️‍⚧️.png]
function builtin(channel, user, text, msg) {
    // check prefix match
    if (!text.startsWith(SETTINGS.builtin.prefix)) return false;
    // check userlevel
    if (!Util.meetsUserlevel({userlevel: "mod"}, msg.userInfo)) {
        console.log(`${user} tried to use builtin @ ${new Date(Date.now()).toISOString()}`);
        chat.say(channel, `Using ${SETTINGS.builtin.prefix} requires mod perms`, {replyTo: msg});
    } else { // userlevel met
        // section: [watermelon pig fruit bowl.jpg]
        const argv = text.split(/\s+/);
        console.log(`${user} used builtin @ ${new Date(Date.now()).toISOString()} w/ subcommand ${argv[1]} (full msg: ${text})`);
        switch (argv[1]) {
            case "cmd":
                builtinCmd(channel, user, text, argv, msg);
                chat.say(channel, `Subcommand cmd not implemented yet; edit ${Util.commandsPath} and ${SETTINGS.builtin.prefix} reload for now`, {replyTo: msg});
                break;
            case "reload":
                const jsonLoaded = fs.readFile(Util.commandsPath, "utf-8").then((val) => {COMMANDS = JSON.parse(val);});
                const mjsLoaded = import(Util.codecmdsPath).then((mod) => {codecmds = mod.codecmds;});
                Promise.all([jsonLoaded, mjsLoaded]).then(() => chat.say(channel, "All commands reloaded", {replyTo: msg})).catch((e) => {
                    chat.say(channel, `Reload failed! @${SECRETS.streamerUsername} Check the terminal and probably restart the bot`, {replyTo: msg});
                    console.error(e);
                }); // do I have to make everything async to write modern js properly?
                break;
            case "shutdown":
                const qaa = () => { // quit after action
                    chat.part(channel);
                    chat.quit();
                    process.nextTick(process.exit, 0); // fr what could go wrong?
                }
                if (isNaN(parseFloat(argv[2]))) chat.action(channel, "slams shut").then(qaa);
                else setTimeout(() => chat.action(channel, "ceases to glow magenta").then(qaa), parseFloat(argv[2]) * 1000);
                break;
            default: chat.say(channel, `Unrecognized subcommand ${argv[1]}`, {replyTo: msg});
        }
    }
    return true;
}
// section: [small girly plastic bike for kids.jpg]
function builtinCmd(channel, user, text, argv, msg) {
    // argv[3] is type, argv[4] is trigger, argv[5] is cmd set's prop name
    if (!isValidType(argv[3])) {
        chat.say(channel, `Valid command types are prefix, infix, and regex, not ${argv[3]}. See README`, {replyTo: msg});
        return;
    }
    let bodyIndex;
    switch (argv[2]) {
        case "add":
            if (COMMANDS[argv[3]][argv[4]])
                chat.say(channel, `${argv[3]} ${argv[4]} already exists; can't overwrite it with cmd add`, {replyTo: msg});
            else {
                bodyIndex = argv.slice(0, 4).reduce((a, b) => a.length + b.length) + 5; // plus 5 spaces
                // async catch callbacks feel nicer than try-catch statements idk
                builtinCmdAddEditAlias(false, argv[3], argv[4], text.substring(bodyIndex))
                    .then(() => chat.say(channel, `Successfully added ${argv[3]} ${argv[4]}`, {replyTo: msg})).catch((e) => {
                        chat.say(channel, `Command add failed (probably just couldn't save to ${Util.commandsPath})! @${SECRETS.streamerUsername} Check the terminal`, {replyTo: msg});
                        console.error(e);
                    });
            }
            break;
        case "edit":
            if (!COMMANDS[argv[3]][argv[4]])
                chat.say(channel, `${argv[3]} ${argv[4]} doesn't even exist`, {replyTo: msg});
            else if (COMMANDS[argv[3]][argv[4]].action !== "text")
                chat.say(channel, `cmd edit only works on text commands and ${argv[3]} ${argv[4]} isn't one`, {replyTo: msg});
            else {
                bodyIndex = argv.slice(0, 4).reduce((a, b) => a.length + b.length) + 5;
                builtinCmdAddEditAlias(false, argv[3], argv[4], text.substring(bodyIndex))
                    .then(() => chat.say(channel, `Successfully edited ${argv[3]} ${argv[4]}`, {replyTo: msg})).catch((e) => {
                        chat.say(channel, `Command edit failed (probably just couldn't save to ${Util.commandsPath})! @${SECRETS.streamerUsername} Check the terminal`, {replyTo: msg});
                        console.error(e);
                    });
            }
            break;
        case "alias":
            if (COMMANDS[argv[3]][argv[4]]?.action !== "alias") // if cmd exists and isn't an alias
                chat.say(channel, `Can't overwrite text ${argv[3]} ${argv[4]} with an alias`, {replyTo: msg});
            else {
                bodyIndex = argv.slice(0, 4).reduce((a, b) => a.length + b.length) + 5;
                builtinCmdAddEditAlias(true, argv[3], argv[4], text.substring(bodyIndex))
                    .then(() => chat.say(channel, `Successfully aliased ${argv[3]} ${argv[4]} to ${text.substring(bodyIndex)}`, {replyTo: msg})).catch((e) => {
                        chat.say(channel, `Aliasing failed (probably just couldn't save to ${Util.commandsPath})! @${SECRETS.streamerUsername} Check the terminal`, {replyTo: msg});
                        console.error(e);
                    });
            }
            break;
        case "set":
            // TODO
            if (!COMMANDS[argv[3]][argv[4]])
                chat.say(channel, `${argv[3]} ${argv[4]} doesn't even exist`, {replyTo: msg});
            else if (!["userlevel", "cooldown", "cd", "enabled", "flags"].includes(argv[5]))
                chat.say(channel, `${argv[5]} isn't a valid property for cmd set. See README`, {replyTo: msg});
            else if (argv[5] === "flags" && argv[3] !== "regex")
                chat.say(channel, `Flags can only be set on regexes`, {replyTo: msg});
            else {
                bodyIndex = argv.slice(0, 5).reduce((a, b) => a.length + b.length) + 6;
                builtinCmdSet(argv[3], argv[4], argv[5], text.substring(bodyIndex))
                    .then((ret) => chat.say(channel, ret, {replyTo: msg})).catch((e) => {
                        chat.say(channel, `Setting failed for some reason! (probably just couldn't save to ${Util.commandsPath})! @${SECRETS.streamerUsername} Check the terminal`, {replyTo: msg});
                        console.error(e);
                    });
            }
            break;
        case "delete": case "remove":
            if (!COMMANDS[argv[3]][argv[4]])
                chat.say(channel, `${argv[3]} ${argv[4]} doesn't exist; there's nothing to delete`, {replyTo: msg});
            else builtinCmdDelete(argv[3], argv[4])
                .then(() => chat.say(channel, `Successfully deleted ${argv[3]} ${argv[4]}`, {replyTo: msg})).catch((e) => {
                    chat.say(channel, `Command deletion failed (probably just couldn't save to ${Util.commandsPath})! @${SECRETS.streamerUsername} Check the terminal`, {replyTo: msg});
                    console.error(e);
                });
            break;
        default:
            // TODO
    }
}
async function builtinCmdAddEditAlias(isAlias, type, trigger, body) {
    // assume cmd add/edit/alias did all the necessary validity checking (eg not adding existing cmd or editing nonexistent cmd)
    // then all those ops reduce to the same thing (add something to commands and save the whole thing to commands.json)
    const userlevel = COMMANDS[type][trigger]?.userlevel ?? (SETTINGS.builtin.cmd.userlevel ?? Util.defaultestUserlevel);
    const cooldown = COMMANDS[type][trigger]?.cooldown ?? (SETTINGS.builtin.cmd.cooldown ?? Util.defaultestCD);
    COMMANDS[type][trigger] = {
        action: isAlias ? "alias" : "text",
        body, userlevel, cooldown, enabled: true
    };
    await saveCommands();
}
async function builtinCmdSet(type, trigger, prop, value) {
    switch (prop) {
        case "userlevel":
            if (!["everyone", "mod", "streamer"].includes(value))
                return `Invalid userlevel ${value} - must be one of everyone/mod/streamer`;
            else {
                COMMANDS[type][trigger].userlevel = value;
                await saveCommands();
                return `Successfully set ${type} ${trigger}'s userlevel to ${value}`;
            }
        case "cooldown": case "cd":
            if (Number.isFinite(Number(value))) {
                COMMANDS[type][trigger].cooldown = Number(value);
                await saveCommands();
                return `Successfully set ${type} ${trigger}'s cooldown to ${Number(value)} s`;
            } else return `Invalid cooldown ${value} - must be a finite number`;
        case "enabled":
            if (!["true", "false"].includes(value))
                return `Invalid enablement ${value} - must be true or false`;
            else {
                const a = value === "true";
                COMMANDS[type][trigger].enabled = a;
                await saveCommands();
                return `Successfully ${a ? "enabled" : "disabled"} ${type} ${trigger}`;
            }
        case "flags":
            try {
                new RegExp(trigger, value);
            } catch (e) {
                return `/${trigger}/${value} isn't a valid regex. See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions`;
            }
            COMMANDS[type][trigger].flags = value;
            await saveCommands();
            return `Successfully set ${type} ${trigger}'s flags to ${value}`;
        default:
            throw new Error("grimoire.mjs:312 reached somehow");
    }
}
async function builtinCmdDelete(type, trigger) {

}
function saveCommands() {
    const prep = (key, value) => (key === "lastUsed" && typeof value === "number") ? undefined : value; // scrub last-use timestamps
    return fs.writeFile(Util.commandsPath, JSON.stringify(COMMANDS, prep, 4), "utf-8");
}