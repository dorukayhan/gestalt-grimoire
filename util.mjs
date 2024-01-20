/**
 * things I thought of using more than once on the spot
 */
class Util {
    /**
     * checks if a given command's cooldown passed
     * @param command 
     */
    static commandNotOnCD(command) {
        // default to 30 sec cd
        const cdTarget = (command.lastUsed ?? 0) + ((command.cooldown ?? 30) * 1000);
        return Date.now() >= cdTarget;
    }
}

export { Util };