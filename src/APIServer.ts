import express from "express";
import helmet from "helmet";
import bodyParser from "body-parser";

import http from "http";
import http2 from "http2";
import spdy from "spdy";

import fs from "fs";
import { Log } from "./Log";

import { DB } from "./DB";

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
        this.expressApp.use(bodyParser.json());

        const router = express.Router();

        router.route("/pages").get(this.getPages);
        router.route("/page/:id").delete(this.deletePage);
        router.route("/page/read/:id").put(this.markPageAsRead);

        router.route("/sites").get(this.getSites);
        router.route("/site").post(this.addSite);
        router.route("/site/:id").put(this.updateSite);
        router.route("/site/:id").delete(this.deleteSite);

        this.expressApp.use("/", router);
    }

    // Routing functions
    private getPages(req: express.Request, res: express.Response)
    {
        const params = req.query;

        const startIndex = parseInt(params.startIndex);
        if(startIndex < 0) {
            res.sendStatus(400);
            return;
        }
        
        DB.getPages({
            onlyUnread: (params.onlyUnread == "true"),
            category: params.category,
            startIndex: startIndex,
            count: parseInt(params.count)
        }).then((r) => {
            res.status(200).json(r);
        })
        .catch((e) => {
            res.sendStatus(500);

            Log.error(`Failed to get the pages. (${e})`);
            Log.error(`    Request parameters: ${JSON.stringify(params)}`);
        });
    }

    private deletePage(req: express.Request, res: express.Response)
    {
        DB.deletePage(req.params.id).then((r) => {
            if(r == 0){
                Log.warn(`Tried to delete the page '${req.params.id}', but could not find.`);
            }

            res.sendStatus(204);
        })
        .catch((e) => {
            res.sendStatus(500);

            Log.error(`Failed to delete the page. (${e})`);
            Log.error(`    Page id: ${req.params.id}`);
        });
    }

    private markPageAsRead(req: express.Request, res: express.Response)
    {
        DB.readPage(req.params.id).then((r) => {
            if(r == 0){
                Log.warn(`Tried to read the page '${req.params.id}', but could not find.`);
            }

            res.sendStatus(204);
        })
        .catch((e) => {
            res.sendStatus(500);

            Log.error(`Failed to read the page. (${e})`);
            Log.error(`    Page id: ${req.params.id}`);
        });
    }

    private getSites(req: express.Request, res: express.Response)
    {
        DB.getWebSites().then((r) => {
            res.status(200).json(r);
        })
        .catch((e) => {
            res.sendStatus(500);

            Log.error(`Failed to get the web sites. (${e})`);
        });
    }

    private addSite(req: express.Request, res: express.Response)
    {
        const params = req.body;

        if(!params.title || !params.url || !params.crawlUrl || !params.cssSelector) {
            res.sendStatus(400);
            return;
        }
        if(!params.category) {
            params.category = "general";
        }

        DB.insertWebSite({
            title: params.title,
            url: params.url,
            crawlUrl: params.crawlUrl,
            cssSelector: params.cssSelector,
            category: params.category,
            lastTitle: ""
        }).then((r) => {
            res.sendStatus(204);
        })
        .catch((e) => {
            res.sendStatus(500);

            Log.error(`Failed to add the web site. (${e})`);
            Log.error(`    Request parameters: ${JSON.stringify(params)}`);
        });
    }

    private updateSite(req: express.Request, res: express.Response)
    {
        const params = req.body;
        
        DB.updateWebSite(req.params.id, {
            crawlUrl: params.crawlUrl,
            cssSelector: params.cssSelector,
            category: params.category
        }).then((r) => {
            if(r == 0){
                Log.warn(`Tried to update the page '${req.params.id}', but could not find.`);
            }

            res.sendStatus(204);
        })
        .catch((e) => {
            res.sendStatus(500);

            Log.error(`Failed to update the web site. (${e})`);
            Log.error(`    Web site id: ${req.params.id}`);
            Log.error(`    Request parameters: ${JSON.stringify(params)}`);
        });
    }

    private deleteSite(req: express.Request, res: express.Response)
    {
        const params = req.body;
        
        DB.deleteWebSite(req.params.id, (params.deleteAllPages == "true")).then((r) => {
            if(r == 0) {
                Log.warn(`Tried to delete the page '${req.params.id}', but could not find.`);
            }

            res.sendStatus(204);
        })
        .catch((e) => {
            res.sendStatus(500);

            Log.error(`Failed to delete the web site. (${e})`);
            Log.error(`    Web site id: ${req.params.id}`);
            Log.error(`    Request parameters: ${JSON.stringify(params)}`);
        })
    }
}
