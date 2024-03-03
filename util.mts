/**
 * things I thought of using more than once on the spot
 */
class Util {
    /**
     * `true` if a given command's cooldown passed
     */
    static isOffCD(command) {
        // default to 30 sec cd
        // TODO try importing { settings } from "./grimoire.mjs"
        const cdTarget = (command.lastUsed ?? 0) + ((command.cooldown ?? 30) * 1000);
        return Date.now() >= cdTarget;
    }
    /**
     * split an alias command's body into the type (prefix/infix/regex)
     * and the trigger (everything after)
     */
    static parseAlias(target) {
        const firstSpaceIndex = target.search(/\s/);
        return {
            type: target.slice(0, firstSpaceIndex),
            trigger: target.slice(firstSpaceIndex + 1)
        };
    }
    /**
     * `true` if `type` is prefix, infix, or regex
     */
    static isValidType(type) {
        return /^(prefix|infix|regex)$/.test(type);
    }
    /**
     * `true` if `user` is allowed to use `command`
     * @param user a ChatUser like `msg.userInfo`
     */
    static meetsUserlevel(command, user) {
        switch (command.userlevel) {
            case "everyone": return true;
            case "mod": return user.isMod || user.isBroadcaster;
            case "streamer": return user.isBroadcaster;
            default:
                console.error(`invalid userlevel ${command.userlevel}! assuming everyone!`);
                return true;
        }
    }
    /**
     * `command.enabled && Util.isOffCD(command) && Util.meetsUserlevel(command, msg.userInfo)`
     */
    static goForLaunch(command, msg) {
        return command.enabled && Util.isOffCD(command) && Util.meetsUserlevel(command, msg.userInfo);
    }
}

export { Util };