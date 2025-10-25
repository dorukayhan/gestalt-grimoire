import { RefreshingAuthProvider } from '@twurple/auth';
import { ChatClient } from '@twurple/chat';
import type { ChatMessage } from '@twurple/chat';
import { promises as fs } from 'fs';
import { Util } from './util.mts';

// useful type aliases
/** command privilege classes, written in order of decreasing privileges */
type Userlevel = 'streamer' | 'mod' | 'everyone';
/** possible things a command can do */
type CommandAction = 'text' | 'code' | 'alias';
/** available command types, keep in sync with commands.json and isValidType */
type CommandType = 'prefix' | 'infix' | 'regex';

/**
 * various settings.
 * file itself should have a default value for every setting
 */
const SETTINGS: {
    /** settings for the built-in command */
    builtin: {
        /** built-in's prefix */
        prefix: string;
        /** default settings for [built-in] cmd add */
        cmd: {
            userlevel: Userlevel;
            cooldown: number;
        }
    }
} = JSON.parse(await fs.readFile(Util.settingsPath, "utf-8"));

/**
 * settings that are a bad idea to put in a public repo
 */
const SECRETS: {
    streamerUsername: string; // your username
    botUsername: string; // guess whose username?
    clientId: string; // from when you did oauth manually
    clientSecret: string; // also from oauth
    /**
     * whether to print things that SHOULD NEVER BE SHOWN ON STREAM
     * OR YOU *WILL* LOSE AN ACCOUNT OR TWO to the terminal
     */
    extremelyStreamUnsafeTerminal: boolean;
} = JSON.parse(await fs.readFile(Util.secretsPath, "utf-8"));
/**
 * access and refresh tokens.
 * see step 7 of https://twurple.js.org/docs/examples/chat/basic-bot.html
 */
const TOKENS = JSON.parse(await fs.readFile(Util.tokensPath, "utf-8"));
/**
 * commands.
 * see README
 */
let COMMANDS: {
    prefix: Record<string, Command>;
    infix: Record<string, Command>;
    regex: Record<string, RegexCommand>;
} = JSON.parse(await fs.readFile(Util.commandsPath, "utf-8"));
interface Command {
    /** 
     * if `text`, the command sends `body` in chat; if `code`, the command
     * calls the function `codecmds[body]`; if `alias`, the command runs
     * another command described by `body`
     */
    action: CommandAction;
    /** see `Command.action` */
    body: string;
    /** minimum userlevel needed for using the command */
    userlevel: Userlevel;
    /** how many seconds must pass before the command is reused */
    cooldown: number;
    /** whether the command works at all */
    enabled: boolean;
    /** `Date.now()` when the command was last used. needed for cooldowns */
    lastUsed?: number;
}
interface RegexCommand extends Command {
    /** regex flags to use. defaults to `su` if not specified */
    flags?: string;
}

// that was all the typedefs, let's get to work

const auth = new RefreshingAuthProvider({
    clientId: SECRETS.clientId,
    clientSecret: SECRETS.clientSecret
});
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
        builtin(channel, user, text, msg) ||
        prefix(channel, user, text, msg) ||
        infix(channel, user, text, msg) ||
        regex(channel, user, text, msg);
    }
});

chat.connect();
// import code commands last to avoid blocking chat.connect() or something idk
let { codecmds } = await import(Util.codecmdsPath);
// one more thing
process.on("exit", (code) => console.log(`exiting w/ code ${code}`));

// the actual command engines

function prefix(channel: string, user: string, text: string, msg: ChatMessage): boolean {
    const [firstword] = text.split(' ', 1); // NO SPACES IN PREFIXES! + SAFETY: can't be undefined, no empty messages
    let command = COMMANDS.prefix[firstword!] // undefined for cmds that don't exist
    if (command && Util.goForLaunch(command, msg)) {
        command.lastUsed = Date.now();
        console.log(`${user} used prefix ${firstword} @ ${new Date(command.lastUsed).toISOString()}`);
        executeCommand(command, channel, user, text, msg);
        return true;
    }
    return false;
}
function infix(channel: string, user: string, text: string, msg: ChatMessage): boolean {
    // can't optimize infix and regex like we can w/ prefix
    // no problem, computers are fast
    for (const trigger in COMMANDS.infix) {
        let command = COMMANDS.infix[trigger]!; // SAFETY: not undefined unless for-in is broken
        if (text.includes(trigger) && Util.goForLaunch(command, msg)) {
            command.lastUsed = Date.now();
            console.log(`${user} used infix ${trigger} @ ${new Date(command.lastUsed).toISOString()}`);
            executeCommand(command, channel, user, text, msg);
            return true;
        }
    }
    return false;
}
function regex(channel: string, user: string, text: string, msg: ChatMessage): boolean {
    for (const trigger in COMMANDS.regex) {
        let command = COMMANDS.regex[trigger]!; // SAFETY: also not undefined unless for-in is broken
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
function executeCommand(command: Command, channel: string, user: string, text: string, msg: ChatMessage) {
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
            // SAFETY: we don't touch the undefined tsPmoIcl if !isValidType(type) so this deceit should be a-ok
            const tsPmoIcl = COMMANDS[type as CommandType];
            if (!Util.isValidType(type) || !tsPmoIcl[trigger]) {
                console.error(`nonexistent alias target ${command.body}`);
                chat.say(channel, `@${SECRETS.streamerUsername} Check the terminal (${command.body} has to exist for its aliases to work)`);
                break;
            }
            if (tsPmoIcl[trigger].action === "alias") { // no recursive aliases
                console.error(`alias target ${command.body} is itself an alias`);
                chat.say(channel, `@${SECRETS.streamerUsername} Check the terminal (${command.body} is an alias itself and can't have aliases)`);
                break;
            }
            // not setting lastUsed for the alias target is intentional
            console.log(`running aliased ${command.body}`)
            executeCommand(tsPmoIcl[trigger], channel, user, text, msg);
            break;
        default:
            console.error(`invalid action ${command.action}`);
            chat.say(channel, `@${SECRETS.streamerUsername} Check the terminal (${command.action} isn't a valid command action)`);
    }
}
// section: [🏳️‍⚧️.png]
function builtin(channel: string, user: string, text: string, msg: ChatMessage) {
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
                // SAFETY: parseFloat(undefined) is just NaN, that's why we check it you silly tsc
                if (isNaN(parseFloat(argv[2]!))) chat.action(channel, "slams shut").then(qaa);
                else setTimeout(() => chat.action(channel, "ceases to glow magenta").then(qaa), parseFloat(argv[2]!) * 1000);
                break;
            default: chat.say(channel, `Unrecognized subcommand ${argv[1]}`, {replyTo: msg});
        }
    }
    return true;
}
// section: [small girly plastic bike for kids.jpg]
function builtinCmd(channel: string, user: string, text: string, argv: string[], msg: ChatMessage) {
    // argv[3] is type, argv[4] is trigger, argv[5] is cmd set's prop name
    if (!Util.isValidType(argv[3])) {
        chat.say(channel, `Valid command types are prefix, infix, and regex, not ${argv[3]}. See README`, {replyTo: msg});
        return;
    }
    // ensure argv[4] exists
    if (argv.length < 5) {
        chat.say(channel, `And what ${argv[3]} do you want to add? See README`, {replyTo: msg});
        return;
    }
    // SAFETY: isValidType and Array.length (xd) must work
    const cmdType = argv[3] as CommandType;
    const trigger = argv[4] as string;
    let bodyIndex: number;
    switch (argv[2]) {
        case "add":
            if (COMMANDS[cmdType][trigger])
                chat.say(channel, `${cmdType} ${trigger} already exists; can't overwrite it with cmd add`, {replyTo: msg});
            else {
                bodyIndex = argv.slice(0, 5).map(s => s.length).reduce((a, b) => a+b, 0) + 5; // plus 5 spaces
                // async catch callbacks feel nicer than try-catch statements idk
                builtinCmdAddEditAlias(false, cmdType, trigger, text.substring(bodyIndex))
                    .then(() => chat.say(channel, `Successfully added ${cmdType} ${trigger}`, {replyTo: msg})).catch((e) => {
                        chat.say(channel, `Command add failed (probably just couldn't save to ${Util.commandsPath})! @${SECRETS.streamerUsername} Check the terminal`, {replyTo: msg});
                        console.error(e);
                    });
            }
            break;
        case "edit":
            if (!COMMANDS[cmdType][trigger])
                chat.say(channel, `${cmdType} ${trigger} doesn't even exist`, {replyTo: msg});
            else if (COMMANDS[cmdType][trigger].action !== "text")
                chat.say(channel, `cmd edit only works on text commands and ${cmdType} ${trigger} isn't one`, {replyTo: msg});
            else {
                bodyIndex = argv.slice(0, 5).map(s => s.length).reduce((a, b) => a+b, 0) + 5;
                builtinCmdAddEditAlias(false, cmdType, trigger, text.substring(bodyIndex))
                    .then(() => chat.say(channel, `Successfully edited ${cmdType} ${trigger}`, {replyTo: msg})).catch((e) => {
                        chat.say(channel, `Command edit failed (probably just couldn't save to ${Util.commandsPath})! @${SECRETS.streamerUsername} Check the terminal`, {replyTo: msg});
                        console.error(e);
                    });
            }
            break;
        case "alias":
            if (COMMANDS[cmdType][trigger] && COMMANDS[cmdType][trigger].action !== "alias") // if cmd exists and isn't an alias
                chat.say(channel, `${cmdType} ${trigger} exists and isn't an alias, can't overwrite it with one`, {replyTo: msg});
            else {
                bodyIndex = argv.slice(0, 5).map(s => s.length).reduce((a, b) => a+b, 0) + 5;
                builtinCmdAddEditAlias(true, cmdType, trigger, text.substring(bodyIndex))
                    .then(() => chat.say(channel, `Successfully aliased ${cmdType} ${trigger} to ${text.substring(bodyIndex)}`, {replyTo: msg})).catch((e) => {
                        chat.say(channel, `Aliasing failed (probably just couldn't save to ${Util.commandsPath})! @${SECRETS.streamerUsername} Check the terminal`, {replyTo: msg});
                        console.error(e);
                    });
            }
            break;
        case "set":
            // TODO
            if (!COMMANDS[cmdType][trigger])
                chat.say(channel, `${cmdType} ${trigger} doesn't even exist`, {replyTo: msg});
            // SAFETY: includes(undefined) is false, which is what we want
            else if (!["userlevel", "cooldown", "cd", "enabled", "flags"].includes(argv[5]!))
                chat.say(channel, `${argv[5]} isn't a valid property for cmd set. See README`, {replyTo: msg});
            else if (argv[5] === "flags" && cmdType !== "regex")
                chat.say(channel, `Flags can only be set on regexes`, {replyTo: msg});
            else {
                bodyIndex = argv.slice(0, 6).map(s => s.length).reduce((a, b) => a+b, 0) + 6;
                builtinCmdSet(cmdType, trigger, argv[5], text.substring(bodyIndex))
                    .then((ret) => chat.say(channel, ret, {replyTo: msg})).catch((e) => {
                        chat.say(channel, `Setting failed for some reason! (probably just couldn't save to ${Util.commandsPath})! @${SECRETS.streamerUsername} Check the terminal`, {replyTo: msg});
                        console.error(e);
                    });
            }
            break;
        case "delete": case "remove":
            if (!COMMANDS[cmdType][trigger])
                chat.say(channel, `${cmdType} ${trigger} doesn't exist; there's nothing to delete`, {replyTo: msg});
            else builtinCmdDelete(cmdType, trigger)
                .then(() => chat.say(channel, `Successfully deleted ${cmdType} ${trigger}`, {replyTo: msg})).catch((e) => {
                    chat.say(channel, `Command deletion failed (probably just couldn't save to ${Util.commandsPath})! @${SECRETS.streamerUsername} Check the terminal`, {replyTo: msg});
                    console.error(e);
                });
            break;
        default:
            // TODO
    }
}
async function builtinCmdAddEditAlias(isAlias: boolean, type: CommandType, trigger: string, body: string) {
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

/** SAFETY: make damn sure COMMANDS[type][trigger] exists before calling */
async function builtinCmdSet(type: CommandType, trigger: string, prop: string|undefined, value: any) {
    switch (prop) {
        case "userlevel":
            if (!["everyone", "mod", "streamer"].includes(value))
                return `Invalid userlevel ${value} - must be one of everyone/mod/streamer`;
            else {
                COMMANDS[type][trigger]!.userlevel = value;
                await saveCommands();
                return `Successfully set ${type} ${trigger}'s userlevel to ${value}`;
            }
        case "cooldown": case "cd":
            if (Number.isFinite(Number(value))) {
                COMMANDS[type][trigger]!.cooldown = Number(value);
                await saveCommands();
                return `Successfully set ${type} ${trigger}'s cooldown to ${Number(value)} s`;
            } else return `Invalid cooldown ${value} - must be a finite number`;
        case "enabled":
            if (!["true", "false"].includes(value))
                return `Invalid enablement ${value} - must be true or false`;
            else {
                const a = value === "true";
                COMMANDS[type][trigger]!.enabled = a;
                await saveCommands();
                return `Successfully ${a ? "enabled" : "disabled"} ${type} ${trigger}`;
            }
        case "flags":
            if (type !== "regex")
                return `Flags can only be set on regex commands, not a ${type}`;
            try {
                new RegExp(trigger, value);
            } catch (e) {
                return `/${trigger}/${value} isn't a valid regex. See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_expressions`;
            }
            COMMANDS[type][trigger]!.flags = value;
            await saveCommands();
            return `Successfully set ${type} ${trigger}'s flags to ${value}`;
        default:
            throw new Error("wasn't this line supposed to be unreachable?");
    }
}
async function builtinCmdDelete(type: CommandType, trigger: string) {
    delete COMMANDS[type][trigger];
    await saveCommands();
}
function saveCommands() {
    const prep = (key: any, value: any) => (key === "lastUsed" && typeof value === "number") ? undefined : value; // scrub last-use timestamps
    return fs.writeFile(Util.commandsPath, JSON.stringify(COMMANDS, prep, 4), "utf-8");
}

// lmao
export type { Command, RegexCommand, Userlevel, CommandAction, CommandType };