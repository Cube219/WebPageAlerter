import { DB } from "./DB";
import { APIServer } from "./APIServer";
// import { WebSiteInfo, WebSiteWatcher } from "./WebSiteWatcher"
import { Core } from "./Core";
import { initLog, Log } from "./Log";

require("dotenv").config();

initLog();

Log.info("Starting WebPageAlerter...");

DB.init({
    url: process.env.DB_URL as string,
    port: parseInt(process.env.DB_PORT as string)
});

const core = new Core();
const api = new APIServer({
    port: 443,
    keyPath: process.env.API_SERVER_KEY_PATH as string,
    certPath: process.env.API_SERVER_CERT_PATH as string
});

core.init().then(r => {
    core.start();
    api.start(core).then(() => {
        Log.info("Successfully started WebPageAlerter.");
    });
});
