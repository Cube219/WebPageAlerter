import koa from "koa";
import koaCors from "@koa/cors";
import koaRouter from "koa-router";
import koaHelmet from "koa-helmet";
import koaBodyParser from "koa-bodyparser";
import koaStatic from "koa-static";
import koaMount from "koa-mount";

import http from "http";
import http2 from "http2";
import jwt from "jsonwebtoken";

import fs from "fs";

import { WebPageInfo, getPageInfo } from "./Utility";
import { Log } from "./Log";
import { Core } from "./Core";

export interface APIServerInitializer
{
    port?: number;
    keyPath: string;
    certPath: string;
    password: string;
    jwtSecretKey: string;
    disableAuth?: boolean;
}

export class APIServer
{
    private core: Core = new Core(); // Empty core

    private koaApp: koa;
    private port: number;
    private password: string; // TODO: 해싱해서 보관하기
    private jwtSecretKey: string;
    private disableAuth: boolean;

    // private httpServer: http.Server;
    private server: http2.Http2SecureServer;

    constructor(init: APIServerInitializer)
    {
        if(init.port) {
            this.port = init.port;
        } else {
            this.port = 443;
        }
        this.password = init.password;
        this.jwtSecretKey = init.jwtSecretKey;
        this.disableAuth = false;
        if(init.disableAuth) {
            this.disableAuth = init.disableAuth;
        }

        this.koaApp = new koa();
        this.initKoa();

        const options = {
            key: fs.readFileSync(init.keyPath),
            cert: fs.readFileSync(init.certPath),
            allowHTTP1: true
        }

        this.server = http2.createSecureServer(options, this.koaApp.callback());

        // Redirect from http to https
        // this.httpServer = http.createServer(function(req, res) {
        //     res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
        //     res.end();
        // });
    }

    public async start(core: Core)
    {
        return new Promise((resolve, reject) => {
            this.core = core;
        
            // this.httpServer.listen(80, ()=> {
            //     Log.info("Started http server for redirecting to https.");

            //     this.server.listen(443, () => {
            //         Log.info("Started APIServer.");

            //         resolve();
            //     });
            // });

            this.server.listen(this.port, () => {
                Log.info(`Started APIServer. (port: ${this.port})`);

                resolve();
            });
        });
    }

    public stop()
    {
        this.server.close();
        // this.httpServer.close();
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
            Log.error(`APIServer: Error in ${ctx.request.method}:${ctx.request.url}\n        ${err.stack}`);
        });

        this.koaApp.use(koaHelmet());
        this.koaApp.use(koaHelmet.contentSecurityPolicy({
            directives: {
                defaultSrc: ["'self'"]
            }
        }));

        this.koaApp.use(koaCors());

        this.koaApp.use(koaBodyParser());

        const authRouter = new koaRouter();
        authRouter.post("/api/auth", this.auth.bind(this));
        this.koaApp.use(authRouter.routes());
        this.koaApp.use(authRouter.allowedMethods())

        if(this.disableAuth == false) {
            this.koaApp.use(this.authMiddleware.bind(this));
        }

        this.koaApp.use(koaMount("/page_data", koaStatic("page_data")));

        const router = new koaRouter();

        router.post("/api/auth/refresh", this.refreshAuth.bind(this))
        
        router.get("/api/pages", this.getPages.bind(this));
        router.get("/api/pages/archieved", this.getArchievedPages.bind(this));
        router.delete("/api/page/:id", this.deletePage.bind(this));
        router.put("/api/page/read/:id", this.markPageAsRead.bind(this));
        router.post("/api/page/archieved", this.archieveNewPage.bind(this));
        router.post("/api/page/archieved/:id", this.archievePage.bind(this));

        router.get("/api/sites", this.getSites.bind(this));
        router.post("/api/site", this.addSite.bind(this));
        router.put("/api/site/:id", this.updateSite.bind(this));
        router.delete("/api/site/:id", this.deleteSite.bind(this));

        this.koaApp.use(router.routes());
        this.koaApp.use(router.allowedMethods());
    }

    private async authMiddleware(ctx: koa.ParameterizedContext, next: () => Promise<any>)
    {
        const token = ctx.headers["x-access-token"] as string;

        if(!token) {
            ctx.response.status = 401;
            return;
        }

        try {
            jwt.verify(token, this.jwtSecretKey);
        } catch(e) {
            if(e instanceof jwt.TokenExpiredError) {
                ctx.response.status = 401;
                ctx.body = "Token Expired";
                return;
            } else if(e instanceof jwt.JsonWebTokenError) {
                ctx.response.status = 401;
                ctx.body = "Token Error";
                return;
            } else {
                throw e;
            }
        }
        
        await next();
    }

    // Routing functions
    private async auth(ctx: koa.ParameterizedContext, next: () => Promise<any>)
    {
        const params = ctx.request.body;

        if(this.password !== params.password) {
            ctx.response.status = 400;
            return;
        }

        const token = jwt.sign({}, this.jwtSecretKey,
            {
                expiresIn: "10d",
                issuer: "WebPageAlerter",
            });

        ctx.response.status = 200;
        ctx.body =  { token: token };
    }

    private async refreshAuth(ctx: koa.ParameterizedContext, next: () => Promise<any>)
    {
        const token = jwt.sign({}, this.jwtSecretKey,
            {
                expiresIn: "10d",
                issuer: "WebPageAlerter",
            });

        ctx.response.status = 200;
        ctx.body = token;
    }

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
                afterId: params.afterId,
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
                afterId: params.afterId,
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
                _id: "",
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
