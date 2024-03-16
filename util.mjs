/**
 * things I thought of using more than once on the spot + a bunch of constants
 */
class Util {
    // why the fuck can't I have a static const?
    /** path of settings.json relative to grimoire.mjs */
    static get settingsPath() { return "conf/settings.json"; }
    /** path of secrets.json relative to grimoire.mjs */
    static get secretsPath() { return "conf/secrets.json"; }
    /** path of tokens.json relative to grimoire.mjs */
    static get tokensPath() { return "conf/tokens.json"; }
    /** path of commands.json relative to grimoire.mjs */
    static get commandsPath() { return "conf/commands.json"; }
    /** path of commands.mjs relative to grimoire.mjs */
    static get codecmdsPath() { return "conf/commands.mjs"; }
    static get defaultestUserlevel() { return "everyone"; }
    static get defaultestCD() { return 30; }
    /**
     * `true` if a given command's cooldown passed
     */
    static isOffCD(command) {
        const cdTarget = (command.lastUsed ?? 0) + ((command.cooldown ?? this.defaultestCD) * 1000);
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
        return ["prefix", "infix", "regex"].includes(type);
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
                console.error(`invalid userlevel ${command.userlevel}! assuming ${this.defaultestUserlevel}!`);
                return Util.meetsUserlevel({userlevel: this.defaultestUserlevel}, user);
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