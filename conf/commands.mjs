import * as fs from "fs"; // can't be bothered to make everything async

const codecmds = {
    hugme: (chat, channel, user, text, msg) => {
        // example stateful codecmd (put the whole thing in the readFile callback I'm sure it'll be fine xdd)
        // use JSON or something for any state more complex than a single number/string/etc
        fs.readFile("conf/cmdstate/hug", "utf-8", (err, data) => {
            let count = (err ? 0 : Number.parseInt(data)) + 1;
            chat.action(channel, `hugs ${user} (hug #${count})`);
            fs.writeFileSync("conf/cmdstate/hug", count.toString(), "utf-8");
        });
    },
    math: (chat, channel, user, text, msg) => {
        // example highly nontrivial codecmd
        const argv = text.split(/\s+/);
        const help = () => chat.say(channel, "This command is a reverse Polish notation calculator. Supported operators are +, -, *, / (four functions), " + 
            "++, ** (sum/product of the whole stack), ^ (Math.pow), % (modulo), swap (the top two numbers), floor, ceil, " +
            "round, trunc (rounding functions), min, max, dup(licate the top number)", {replyTo: msg});
        if (argv.length <= 1) {
            help(); return;
        }
        let stack = [];
        console.log(`codecmds.math: rpn evaling ${argv.slice(1).join(" ")}`);
        for (const token of argv.slice(1)) {
            let lhs, rhs;
            switch (token) {
                // basic functions
                case "+": rhs = stack.pop() ?? 0; lhs = stack.pop() ?? 0; stack.push(lhs + rhs); break;
                case "-": rhs = stack.pop() ?? 0; lhs = stack.pop() ?? 0; stack.push(lhs - rhs); break;
                case "*": rhs = stack.pop() ?? 1; lhs = stack.pop() ?? 1; stack.push(lhs * rhs); break;
                case "/": rhs = stack.pop() ?? 1; lhs = stack.pop() ?? 1; stack.push(lhs / rhs); break;
                case "%": rhs = stack.pop() ?? 1; lhs = stack.pop() ?? 1; stack.push(lhs % rhs); break;
                case "^": rhs = stack.pop() ?? 1; lhs = stack.pop() ?? 1; stack.push(Math.pow(lhs, rhs)); break;
                // capital sigma and pi
                case "++": stack = [stack.reduce((a, b) => a + b, 0)]; break;
                case "**": stack = [stack.reduce((a, b) => a * b, 1)]; break;
                // stack utils
                case "swap": if (stack.length >= 2) {rhs = stack.pop(); lhs = stack.pop(); stack.push(rhs); stack.push(lhs);} break;
                case "dup": if (stack.length >= 1) {rhs = stack.pop(); stack.push(rhs); stack.push(rhs);} break;
                // Math.whatever
                // abusing the object["property"] notation to avoid repeating myself
                case "floor": case "ceil": case "round": case "trunc": stack.push(Math[token](stack.pop())); break;
                case "min": case "max": if (stack.length >= 2) {rhs = stack.pop(); lhs = stack.pop(); stack.push(Math[token](lhs, rhs));} break;
                default: rhs = Number.parseFloat(token); if (Number.isNaN(rhs)) {help(); return;} stack.push(rhs);
            }
        }
        chat.say(channel, `${stack.length === 1 ? stack[0] : stack.toString()}`, {replyTo: msg});
    }
}

export { codecmds };