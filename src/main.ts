import { APIServer } from "./APIServer";
import { WebSiteInfo, WebSiteWatcher } from "./WebSiteWatcher"

require("dotenv").config();

const api = new APIServer({
    port: 443,
    keyPath: process.env.API_SERVER_KEY_PATH as string,
    certPath: process.env.API_SERVER_CERT_PATH as string
});
api.start();

const siteInfo: WebSiteInfo = {
    title: "test",
    url: "test",
    crawlUrl: "test",
    cssSelector: "test",
    lastTitle: "test",
    category: "test"
};
const watcher = new WebSiteWatcher({
    info: siteInfo,
    intervalTimeSec: 5
});
watcher.run();
