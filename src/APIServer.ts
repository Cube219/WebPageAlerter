import koa from "koa";
import koaRouter from "koa-router";
import koaHelmet from "koa-helmet";
import koaBodyParser from "koa-bodyparser";

import http from "http";
import http2 from "http2";

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
    private koaApp: koa;
    private port: number;

    private httpServer: http.Server;
    private server: http2.Http2SecureServer;

    constructor(init: APIServerInitializer)
    {
        this.port = init.port;

        this.koaApp = new koa();
        this.initKoa();

        const options = {
            key: fs.readFileSync(init.keyPath),
            cert: fs.readFileSync(init.certPath),
            allowHTTP1: true
        }

        this.server = http2.createSecureServer(options, this.koaApp.callback());

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
        this.server.listen(443, () => {
            Log.info("Started APIServer.");
        });
    }

    public stop()
    {
        this.server.close();
        this.httpServer.close();
    }

    private initKoa()
    {
        this.koaApp.use(async (ctx, next) => {
            try {
                await next();
            } catch (err) {
                ctx.status = 500;
                ctx.app.emit("error", err, ctx);
            }
        });
        this.koaApp.on("error", (err, ctx) => {
            Log.error(`Error in ${ctx.request.method}:${ctx.request.url}\n        ${err.stack}`);
        });

        this.koaApp.use(koaHelmet());
        this.koaApp.use(koaHelmet.contentSecurityPolicy({
            directives: {
                defaultSrc: ["'self'"]
            }
        }));

        this.koaApp.use(koaBodyParser());

        const router = new koaRouter();
        
        router.get("/pages", this.getPages);
        router.delete("/page/:id", this.deletePage);
        router.put("/page/read/:id", this.markPageAsRead);

        router.get("/sites", this.getSites);
        router.post("/site", this.addSite);
        router.put("/site/:id", this.updateSite);
        router.delete("/site/:id", this.deleteSite);

        this.koaApp.use(router.routes());
        this.koaApp.use(router.allowedMethods());
    }

    // Routing functions
    private async getPages(ctx: koa.ParameterizedContext, next: () => Promise<any>)
    {
        const params = ctx.query;

        const startIndex = parseInt(params.startIndex);
        if(startIndex < 0) {
            ctx.response.status = 400;
            return;
        }

        try {
            const r = await DB.getPages({
                onlyUnread: (params.onlyUnread == "true"),
                category: params.category,
                startIndex: startIndex,
                count: parseInt(params.count)
            });

            ctx.response.status = 200;
            ctx.body = r;
        } catch(e) {
            e.message += `\n        Request parameters: ${JSON.stringify(params)}`;
            throw e;
        }
    }

    private async deletePage(ctx: koa.ParameterizedContext, next: () => Promise<any>)
    {
        try {
            const res = await DB.deletePage(ctx.params.id);
            
            if(res == 0) {
                Log.warn(`Tried to delete the page '${ctx.params.id}', but could not find.`);
            }

            ctx.status = 204;
        } catch(e) {
            e.message += `${e}\n        Page id: ${ctx.params.id}`;
            throw e;
        }
    }

    private async markPageAsRead(ctx: koa.ParameterizedContext, next: () => Promise<any>)
    {
        try {
            const res = await DB.readPage(ctx.params.id);

            if(res == 0) {
                Log.warn(`Tried to read the page '${ctx.params.id}', but could not find.`);
            }

            ctx.status = 204;
        } catch(e) {
            e.message += `${e}\n        Page id: ${ctx.parmas.id}`;
            throw e;
        }
    }

    private async getSites(ctx: koa.ParameterizedContext, next: () => Promise<any>)
    {
        const res = await DB.getWebSites();
        
        ctx.status = 200;
        ctx.body = res;
    }

    private async addSite(ctx: koa.ParameterizedContext, next: () => Promise<any>)
    {
        const params = ctx.request.body;

        if(!params.title || !params.url || !params.crawlUrl || !params.cssSelector) {
            ctx.status = 400;
            return;
        }
        if(!params.category) {
            params.category = "general";
        }

        try {
            await DB.insertWebSite({
                title: params.title,
                url: params.url,
                crawlUrl: params.crawlUrl,
                cssSelector: params.cssSelector,
                category: params.category,
                lastTitle: ""
            });

            ctx.status = 204;
        } catch(e) {
            e.message += `${e}\n        Request parameters: ${JSON.stringify(params)}`;
            throw e;
        }
    }

    private async updateSite(ctx: koa.ParameterizedContext, next: () => Promise<any>)
    {
        const params = ctx.request.body;
        
        try {
            const res = await DB.updateWebSite(ctx.params.id, {
                crawlUrl: params.crawlUrl,
                cssSelector: params.cssSelector,
                category: params.category
            });

            if(res == 0) {
                Log.warn(`Tried to update the page '${ctx.params.id}', but could not find.`);
            }

            ctx.status = 204;
        } catch(e) {
            e.message += `${e}\n        Web site id: ${ctx.params.id}\n    Request parameters: ${JSON.stringify(params)}`
            throw e;
        }
    }

    private async deleteSite(ctx: koa.ParameterizedContext, next: () => Promise<any>)
    {
        const params = ctx.request.body;
        
        try {
            const res = await DB.deleteWebSite(ctx.params.id, (params.deleteAllPages == "true"));

            if(res == 0) {
                Log.warn(`Tried to delete the page '${ctx.params.id}', but could not find.`);
            }

            ctx.state = 204;
        } catch(e) {
            e.message += `${e}\n        Web site id: ${ctx.params.id}\n    Request parameters: ${JSON.stringify(params)}`;
            throw e;
        }
    }
}
