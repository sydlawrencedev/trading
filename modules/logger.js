var chalk = require("chalk");
var fs = require("fs");
var moment = require("moment");
var settings = require("../settings");
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
    mode: "unknown",
    toLog: [],
    writeLogToFile: function() {
        if (this.toLog.length > 0 && !this.isLogging) {
            this.isLogging = true;
            var filename = process.mainModule.path+"/logs/log_"+this.mode+"_"+moment().format("YYYY-MM-DD-HH")+".log";
            var t = {
                timestamp: (new Date()).getTime(),
                text: this.toLog.shift(),
            }
            fs.appendFile(filename, JSON.stringify(t)+"\n", e => {
                logger.writeLogToFile();
            });
        } else {
            this.isLogging = false;
        }
    },
    log: function(text, date = moment(), chalkColor = false) {
        this.toLog.push(text);
        this.writeLogToFile();
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
        if (settings.verbose) {
            this.log(["SETUP", text]);
        }
    },
    error: function(text, date) {
        if (text[0].indexOf("ERROR") == -1) {
            text = ["ERROR", text];
        }
        this.log(text,date,"red");
    },
    warn: function(text, date) {
        if (text[0].indexOf("WARN") == -1) {
            text = [chalk.yellow("WARN"), text];
        }
        this.log(text,date);
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
