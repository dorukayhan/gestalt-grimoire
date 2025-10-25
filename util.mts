import type { ChatUser, ChatMessage } from '@twurple/chat';
import type { Command, Userlevel } from './grimoire.mts';

/**
 * things I thought of using more than once on the spot + a bunch of constants
 */
class Util {
    // why tf can't I have a static const?
    /** path of settings.json relative to grimoire.mts */
    static get settingsPath() { return "conf/settings.json"; }
    /** path of secrets.json relative to grimoire.mts */
    static get secretsPath() { return "conf/secrets.json"; }
    /** path of tokens.json relative to grimoire.mts */
    static get tokensPath() { return "conf/tokens.json"; }
    /** path of commands.json relative to grimoire.mts */
    static get commandsPath() { return "conf/commands.json"; }
    /** path of commands.mts relative to grimoire.mts */
    static get codecmdsPath() { return "./conf/commands.mts"; }
    static get defaultestUserlevel(): Userlevel { return "everyone"; }
    static get defaultestCD() { return 30; }
    /**
     * `true` if a given command's cooldown passed
     */
    static isOffCD(command: Command) {
        const cdTarget = (command.lastUsed ?? 0) + ((command.cooldown ?? this.defaultestCD) * 1000);
        return Date.now() >= cdTarget;
    }
    /**
     * split an alias command's body into the type (prefix/infix/regex)
     * and the trigger (everything after)
     */
    static parseAlias(target: string) {
        const firstSpaceIndex = target.search(/\s/);
        return {
            type: target.slice(0, firstSpaceIndex),
            trigger: target.slice(firstSpaceIndex + 1)
        };
    }
    /**
     * `true` if `type` is prefix, infix, or regex
     */
    static isValidType(type?: string) {
        // SAFETY: includes(undefined) is false, which is what we want
        return ["prefix", "infix", "regex"].includes(type!);
    }
    /**
     * `true` if `user` is at or above `command.userlevel`
     */
    static meetsUserlevel(command: { userlevel: Userlevel }, user: ChatUser): boolean {
        switch (command.userlevel) {
            case "everyone": return true;
            case "mod": return user.isMod || user.isBroadcaster;
            case "streamer": return user.isBroadcaster;
            default:
                console.error(`invalid userlevel ${command.userlevel}! assuming ${Util.defaultestUserlevel}!`);
                return Util.meetsUserlevel({userlevel: Util.defaultestUserlevel}, user);
        }
    }
    /**
     * `command.enabled && Util.isOffCD(command) && Util.meetsUserlevel(command, msg.userInfo)`
     */
    static goForLaunch(command: Command, msg: ChatMessage) {
        return command.enabled && Util.isOffCD(command) && Util.meetsUserlevel(command, msg.userInfo);
    }
}

export { Util };