import { DB } from "./DB";
import { APIServer } from "./APIServer";
import { Core } from "./Core";
import { initLog, Log } from "./Log";

require("dotenv").config();

initLog();

var version = require('../package.json').version;
Log.info(`Starting WebPageAlerter... (var: ${version})`);

DB.init({
    url: process.env.DB_URL as string,
    port: parseInt(process.env.DB_PORT as string)
});

const core = new Core();
const api = new APIServer({
    port: parseInt(process.env.API_PORT as string),
    keyPath: process.env.API_SERVER_KEY_PATH as string,
    certPath: process.env.API_SERVER_CERT_PATH as string,
    password: process.env.API_SERVER_PASSWORD as string,
    jwtSecretKey: process.env.JWT_SIGNATURE_SECRET_KEY as string,
    disableAuth: true
});

core.init().then(r => {
    core.start();
    api.start(core).then(() => {
        Log.info("Successfully started WebPageAlerter.");
    });
});
