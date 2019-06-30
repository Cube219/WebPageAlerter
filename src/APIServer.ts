import koa from "koa";
import koaRouter from "koa-router";
import koaHelmet from "koa-helmet";
import koaBodyParser from "koa-bodyparser";
import koaStatic from "koa-static";

import http from "http";
import http2 from "http2";

import fs from "fs";

import moment from "moment";
import request from "request";
import cheerio from "cheerio"; 

import { Log } from "./Log";
import { Core } from "./Core";
import { WebPageInfo } from "./WebSiteWatcher";

function req(url: string, options?: request.CoreOptions): Promise<any> {
    return new Promise(function(resolve, reject) {
        request(url, options, function(err, response, body) {
            if(err) return reject(err);

            resolve(body);
        });
    });
}

// TODO: WebSiteWatcher에 있는 savePage와 거의 같음
//       나중에 두개 합칠 예정
async function getPageInfo(pageUrl: string)
{
    const res = await req(pageUrl);
        
    const $ = cheerio.load(res);
    let selected: Cheerio;

    let title = "";
    selected = $('meta[property="og:title"]');
    if(selected.length != 0) {
        title = selected[0].attribs.content
    }
    let url = "";
    selected = $('meta[property="og:url"]');
    if(selected.length != 0) {
        url = selected[0].attribs.content;
    }
    let imageUrl = "";
    selected = $('meta[property="og:image"]');
    if(selected.length != 0) {
        imageUrl = selected[0].attribs.content;
    }
    let desc = "";
    selected = $('meta[property="og:description"]');
    if(selected.length != 0) {
        desc = selected[0].attribs.content;
    }
    
    const page: WebPageInfo = {
        siteId: "",
        title: title,
        url: url,
        imageUrl: imageUrl,
        desc: desc,
        category: "",
        time: moment().toDate(),
        isRead: false
    };

    return page;
}

export interface APIServerInitializer
{
    port: number;
    keyPath: string;
    certPath: string;
}

export class APIServer
{
    private core: Core = new Core(); // Empty core

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

    public async start(core: Core)
    {
        return new Promise((resolve, reject) => {
            this.core = core;
        
            this.httpServer.listen(80, ()=> {
                Log.info("Started http server for redirecting to https.");

                this.server.listen(443, () => {
                    Log.info("Started APIServer.");

                    resolve();
                });
            });
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

        this.koaApp.use(koaStatic("page_data"));

        const router = new koaRouter();
        
        router.get("/pages", this.getPages.bind(this));
        router.get("/pages/archieved", this.getArchievedPages.bind(this));
        router.delete("/page/:id", this.deletePage.bind(this));
        router.put("/page/read/:id", this.markPageAsRead.bind(this));
        router.post("/page/archieved", this.archieveNewPage.bind(this));
        router.post("/page/archieved/:id", this.archievePage.bind(this));

        router.get("/sites", this.getSites.bind(this));
        router.post("/site", this.addSite.bind(this));
        router.put("/site/:id", this.updateSite.bind(this));
        router.delete("/site/:id", this.deleteSite.bind(this));

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
            const r = await this.core.getPages({
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

    // TODO: 위에 것이랑 합치기?
    private async getArchievedPages(ctx: koa.ParameterizedContext, next: () => Promise<any>)
    {
        const params = ctx.query;

        const startIndex = parseInt(params.startIndex);
        if(startIndex < 0) {
            ctx.response.status = 400;
            return;
        }

        try {
            const r = await this.core.getPages({
                onlyUnread: (params.onlyUnread == "true"),
                category: params.category,
                startIndex: startIndex,
                count: parseInt(params.count)
            }, true);

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
            await this.core.deletePage(ctx.params.id);

            ctx.status = 204;
        } catch(e) {
            e.message += `${e}\n        Page id: ${ctx.params.id}`;
            throw e;
        }
    }

    private async markPageAsRead(ctx: koa.ParameterizedContext, next: () => Promise<any>)
    {
        try {
            await this.core.readPage(ctx.params.id);

            ctx.status = 204;
        } catch(e) {
            e.message += `${e}\n        Page id: ${ctx.parmas.id}`;
            throw e;
        }
    }

    private async archieveNewPage(ctx: koa.ParameterizedContext, next: () => Promise<any>)
    {
        const params = ctx.request.body;

        const info: WebPageInfo = await getPageInfo(params.url);
        info.category = params.category;
        info.isRead = true;

        try {
            await this.core.archieveNewPage(info);

            ctx.status = 204;
        } catch(e) {
            e.message += `${e}\n        Request parameters: ${JSON.stringify(params)}`;
            throw e;
        }
    }

    private async archievePage(ctx: koa.ParameterizedContext, next: () => Promise<any>)
    {
        await this.core.archievePage(ctx.params.id);

        ctx.status = 204;
    }

    private async getSites(ctx: koa.ParameterizedContext, next: () => Promise<any>)
    {
        const res = await this.core.getWebSites();
        
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
        if(!params.checkingCycleSec) {
            params.checkingCycleSec = 900;
        }

        try {
            await this.core.insertWebSite({
                title: params.title,
                url: params.url,
                crawlUrl: params.crawlUrl,
                cssSelector: params.cssSelector,
                category: params.category,
                lastUrl: "",
                checkingCycleSec: params.checkingCycleSec
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
            await this.core.updateWebSite(ctx.params.id, {
                crawlUrl: params.crawlUrl,
                cssSelector: params.cssSelector,
                category: params.category
            });

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
            await this.core.deleteWebSite(ctx.params.id, (params.deleteAllPages == "true"));

            ctx.status = 204;
        } catch(e) {
            e.message += `${e}\n        Web site id: ${ctx.params.id}\n    Request parameters: ${JSON.stringify(params)}`;
            throw e;
        }
    }
}
