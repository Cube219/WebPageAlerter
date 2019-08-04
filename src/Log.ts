import winston from "winston";
import winstonDaily from "winston-daily-rotate-file";
import moment from "moment";
import fs from "fs";

let logger: winston.Logger;
export { logger as Log }

export function initLog()
{
    if(fs.existsSync("logs") == false) {
        fs.mkdirSync("logs");
    }

    const format = winston.format.printf((info) => 
        `${moment().format("YYYY-MM-DD HH:mm:ss")} [${info.level.toUpperCase()}] - ${info.message}`
    );

    const fileTransport = new winstonDaily({
        filename: "logs/%DATE%-logs.log",
        datePattern: "YYYY-MM-DD",
        maxSize: "128k",
        // maxFiles: "30d",
        format: format
    });

    const consoleTransport = new winston.transports.Console({
        format: winston.format.combine(winston.format.colorize(), format)
    });

    logger = winston.createLogger({
        transports: [ fileTransport, consoleTransport ]
    });
}
