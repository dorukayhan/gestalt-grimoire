import { RefreshingAuthProvider } from '@twurple/auth';
import { Bot, createBotCommand } from '@twurple/easy-bot';
import { promises as fs } from 'fs';

/**
 * various settings and options and knobs
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
const auth = new RefreshingAuthProvider({
    clientId: secrets.clientId,
    clientSecret: secrets.clientSecret
});

auth.onRefresh(async (userId, newToken) => {
    console.log("refreshing access token, check tokens.json");
    if (!(secrets.streamSafeTerminal ?? true))
        console.log(JSON.stringify(newToken)); // in case writeFile fails
    await fs.writeFile("conf/tokens.json", JSON.stringify(newToken, null, 4), "utf-8");
});
await auth.addUserForToken(tokens, ["chat"]);

/** the */
const bot = new Bot({
    authProvider: auth,
    channels: [secrets.streamerUsername],
    commands: [
        createBotCommand("spinrightround", (params, ctx) => {
            console.log(`getting rotated by ${ctx.userName}`);
            ctx.say("owoSpin YaeSpin AINTNOWAY");
        })
    ]
});

bot.onJoin((joinEvent) => {
    console.log(`joined ${joinEvent.broadcasterName}'s chat`);
    bot.say(joinEvent.broadcasterName, "Hellowo");
});