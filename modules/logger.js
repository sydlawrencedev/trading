var chalk = require("chalk");
var moment = require("moment");
chalk.colorize = function(val, base, str) {
    if (val > base) {
        return chalk.bgGreen(chalk.black(str))
    } else if (val < base) {
        return chalk.bgRed(chalk.white(str))
    } else {
        return chalk.bgYellow(chalk.black(str))
    }
}

var logger = {
    verbose: true,
    log: function(text, date = moment(), chalkColor = false) {
        if (typeof text !== "string") {
            text = text.flat().join("\t");
        }

        if (chalkColor) {
            text = chalk[chalkColor](text);
        }

        console.log(date.format("DD/MM/YYYY HH:mm:ss"), text);
    },
    status: function(text) {
        this.log(["STATUS", text]);
    },
    setMode: function(mode) {
        this.mode = mode;
    },
    setup: function(text) {
        this.log(["SETUP", text]);
    },
    error: function(text, date) {
        this.log(text,date,"red");
    },
    success: function(text, date) {
        this.log(text,date,"green");
    },
    alert: function(text, date) {
        this.log(text,date,"yellow");
    }
}

class Singleton {
    constructor() {
        return logger;
    }
}
module.exports = new Singleton();
