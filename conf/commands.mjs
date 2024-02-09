import * as fs from "fs"; // can't be bothered to make everything async

const codecmds = {
    hugme: (chat, channel, user, text, msg) => {
        // example stateful command (put the whole thing in the readFile callback I'm sure it'll be fine xdd)
        fs.readFile("conf/cmdstate/hug", "utf-8", (err, data) => {
            let count = (err ? 0 : Number.parseInt(data)) + 1;
            chat.action(channel, `hugs ${user} (hug #${count})`);
            fs.writeFileSync("conf/cmdstate/hug", count.toString(), "utf-8");
        });
    }
}

export { codecmds };