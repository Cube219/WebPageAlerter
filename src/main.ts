import { APIServer } from "./APIServer";
import { WebSiteInfo, WebSiteWatcher } from "./WebSiteWatcher"

const api = new APIServer({
    port: 443,
    keyPath: "self.key",
    certPath: "self.crt"
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
