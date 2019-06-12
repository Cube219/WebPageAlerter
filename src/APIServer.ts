import express from "express";
import helmet from "helmet";
import bodyParser from "body-parser";

import http from "http";
import http2 from "http2";
import spdy from "spdy";

import fs from "fs";
import { Log } from "./Log";

export interface APIServerInitializer
{
    port: number;
    keyPath: string;
    certPath: string;
}

export class APIServer
{
    private expressApp: express.Express;
    private port: number;

    private spdyServer: spdy.Server;
    private httpServer: http.Server;

    constructor(init: APIServerInitializer)
    {
        this.port = init.port;

        this.expressApp = express();
        this.initExpress();

        const options = {
            key: fs.readFileSync(init.keyPath),
            cert: fs.readFileSync(init.certPath)
        }
        // http2.createSecureServer(options, this.expressApp).listen(this.port);
        this.spdyServer = spdy.createServer(options, this.expressApp);
        // Redirect from http to https
        this.httpServer = http.createServer(function(req, res) {
            res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
            res.end();
        });
    }

    public start()
    {
        this.httpServer.listen(80, ()=> {
            Log.info("Started http server for redirecting to https.")
        });
        this.spdyServer.listen(443, ()=> {
            Log.info("Started APIServer.");
        });
    }

    public stop()
    {
        this.spdyServer.close();
        this.httpServer.close();
    }

    private initExpress()
    {
        this.expressApp.use(helmet());
        this.expressApp.use(helmet.contentSecurityPolicy({
            directives: {
                defaultSrc: ["'self'"]
            }
        }))

        this.expressApp.use(bodyParser.urlencoded({ extended: false}));

        const router = express.Router();

        router.route("/page-infos").get(this.getPageInfos);
        router.route("/page").delete(this.deletePage);
        router.route("/page/read").post(this.markPageAsRead);

        router.route("/site-infos").get(this.getSiteInfos);
        router.route("/site").put(this.addSite);
        router.route("/site").delete(this.deleteSite);

        this.expressApp.use("/", router);
    }

    // Routing functions
    private getPageInfos(req: express.Request, res: express.Response)
    {
        res.set({ 'content-type': 'application/json; charset=utf-8' });
        res.write("구현중");
        res.end();
    }

    private deletePage(req: express.Request, res: express.Response)
    {
        res.set({ 'content-type': 'application/json; charset=utf-8' });
        res.write("구현중");
        res.end();
    }

    private markPageAsRead(req: express.Request, res: express.Response)
    {
        res.set({ 'content-type': 'application/json; charset=utf-8' });
        res.write("구현중");
        res.end();
    }

    private getSiteInfos(req: express.Request, res: express.Response)
    {
        res.set({ 'content-type': 'application/json; charset=utf-8' });
        res.write("구현중");
        res.end();
    }

    private addSite(req: express.Request, res: express.Response)
    {
        res.set({ 'content-type': 'application/json; charset=utf-8' });
        res.write("구현중");
        res.end();
    }

    private deleteSite(req: express.Request, res: express.Response)
    {
        res.set({ 'content-type': 'application/json; charset=utf-8' });
        res.write("구현중");
        res.end();
    }
}
