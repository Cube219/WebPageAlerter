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

import { WebPageInfo, getPageInfo, parseBoolean } from "./Utility";
import { Log } from "./Log";
import { Core } from "./Core";
import { WPAError, MissingRequiredParametersError } from "./Errors";

export interface APIServerInitializer
{
    port?: number;

    useHttp2?: boolean;
    keyPath?: string;
    certPath?: string;

    password: string;
    jwtSecretKey: string;
    enableAuth?: boolean;
}

export class APIServer
{
    private core: Core = new Core(); // Empty core

    private koaApp: koa;
    private port: number;
    private password: string; // TODO: 해싱해서 보관하기
    private jwtSecretKey: string;
    private enableAuth: boolean;

    private http2Server!: http2.Http2SecureServer;
    private httpServer!: http.Server;

    constructor(init: APIServerInitializer)
    {
        if(init.port) {
            this.port = init.port;
        } else {
            if(init.useHttp2 == true) {
                this.port = 443;
            } else {
                this.port = 80;
            }
        }
        this.password = init.password;
        this.jwtSecretKey = init.jwtSecretKey;
        this.enableAuth = false;
        if(init.enableAuth) {
            this.enableAuth = init.enableAuth;
        }

        this.koaApp = new koa();
        this.initKoa();

        if(init.useHttp2 == true) {
            const options = {
                key: fs.readFileSync(init.keyPath as string),
                cert: fs.readFileSync(init.certPath as string),
                allowHTTP1: true
            };

            this.http2Server = http2.createSecureServer(options, this.koaApp.callback());
        } else {
            this.httpServer = http.createServer(this.koaApp.callback());
        }
    }

    public async start(core: Core)
    {
        return new Promise((resolve, reject) => {
            this.core = core;
        
            if(this.http2Server != null) {
                this.http2Server.listen(this.port, () => {
                    Log.info(`Started APIServer. (Protocol: http/2, Port: ${this.port})`);

                    resolve();
                });
            } else {
                this.httpServer.listen(this.port, () => {
                    Log.info(`Started APIServer. (Protocol: http, Port: ${this.port})`);

                    resolve();
                });
            }
        });
    }

    public stop()
    {
        if(this.http2Server != null) {
            this.http2Server.close();
        }
        if(this.httpServer != null) {
            this.httpServer.close();
        }
    }

    private initKoa()
    {
        this.koaApp.use(async (ctx, next) => {
            try {
                await next();
            } catch (err) {
                if(err instanceof WPAError) {
                    ctx.status = err.statusCode;
                    ctx.body = err.responseMessage;
                } else {
                    ctx.status = 500;
                }
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

        this.koaApp.use(koaMount("/page_data", koaStatic("page_data", { maxage: 2592000000 /* 30 days */ })));

        if(this.enableAuth == true) {
            this.koaApp.use(this.authMiddleware.bind(this));
        }

        const router = new koaRouter();

        router.get("/api/auth/check", this.checkAuth.bind(this));
        router.post("/api/auth/refresh", this.refreshAuth.bind(this));
        
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

        router.get("/api/category", this.getCategories.bind(this));
        router.post("/api/category", this.addCategory.bind(this));
        router.delete("/api/category", this.deleteCategory.bind(this));

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
                ctx.body = "Token expired";
                return;
            } else if(e instanceof jwt.JsonWebTokenError) {
                ctx.response.status = 401;
                ctx.body = "Token error";
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

        if(!params.password) {
            throw new MissingRequiredParametersError(['password']);;
        }

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

    private async checkAuth(ctx: koa.ParameterizedContext, next: () => Promise<any>)
    {
        ctx.response.status = 200;
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
                categoryWithSub: parseBoolean(params.categoryWithSub),
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
                categoryWithSub: parseBoolean(params.categoryWithSub),
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
            e.message += `\n        Page id: ${ctx.params.id}`;
            throw e;
        }
    }

    private async markPageAsRead(ctx: koa.ParameterizedContext, next: () => Promise<any>)
    {
        const params = ctx.request.body;
        let setUnread: boolean = false;
        if(params.setUnread && params.setUnread == true) {
            setUnread = true;
        }

        try {
            await this.core.readPage(ctx.params.id, setUnread);

            ctx.status = 204;
        } catch(e) {
            e.message += `\n        Page id: ${ctx.params.id}`;
            throw e;
        }
    }

    private async archieveNewPage(ctx: koa.ParameterizedContext, next: () => Promise<any>)
    {
        const params = ctx.request.body;

        let notExistedParams: string[] = [];
        if(!params.url) {
            notExistedParams.push('url');
        }
        if(!params.category) {
            notExistedParams.push('category');
        }
        if(notExistedParams.length > 0) {
            throw new MissingRequiredParametersError(notExistedParams);
        }

        try {
            const info: WebPageInfo = await getPageInfo(params.url);
            info.category = params.category;
            info.isRead = true;

            await this.core.archieveNewPage(info);

            ctx.status = 200;
            ctx.body = info;
        } catch(e) {
            e.message += `\n        Request parameters: ${JSON.stringify(params)}`;
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

        let notExistedParams: string[] = [];
        if(!params.title) {
            notExistedParams.push('title');
        }
        if(!params.url) {
            notExistedParams.push('url');
        }
        if(!params.crawlUrl) {
            notExistedParams.push('crawlUrl');
        }
        if(!params.cssSelector) {
            notExistedParams.push('cssSelector');
        }
        if(notExistedParams.length > 0) {
            throw new MissingRequiredParametersError(notExistedParams);
        }

        if(!params.category) {
            params.category = "general";
        }
        if(!params.checkingCycleSec) {
            params.checkingCycleSec = 3600;
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
                checkingCycleSec: params.checkingCycleSec,
                isDisabled: false
            });

            ctx.status = 204;
        } catch(e) {
            e.message += `\n        Request parameters: ${JSON.stringify(params)}`;
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
                category: params.category,
                checkingCycleSec: parseInt(params.checkingCycleSec) || undefined,
                isDisabled: parseBoolean(params.isDisabled)
            });

            ctx.status = 204;
        } catch(e) {
            e.message += `\n        Request parameters: ${JSON.stringify(params)}`
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
            e.message += `\n        Request parameters: ${JSON.stringify(params)}`;
            throw e;
        }
    }

    private async getCategories(ctx: koa.ParameterizedContext, next: () => Promise<any>)
    {
        const params = ctx.query;

        try {
            let categoryName: string = '';
            let withSub: boolean = true;

            if(params.name) {
                categoryName = params.name;
            }
            if(params.withSub) {
                const temp = parseBoolean(params.withSub);
                if(temp != undefined) {
                    withSub = temp;
                }
            }
            const r = await this.core.getCategories(categoryName, withSub);

            ctx.status = 200;
            ctx.body = r;
        } catch(e) {
            e.message += `\n        Request parameters: ${JSON.stringify(params)}`;
            throw e;
        }
    }

    private async addCategory(ctx: koa.ParameterizedContext, next: () => Promise<any>)
    {
        const params = ctx.request.body;

        if(!params.name) {
            throw new MissingRequiredParametersError(['name']);
        }

        try {
            await this.core.addCategory(params.name);

            ctx.status = 204;
        } catch(e) {
            e.message += `\n        Request parameters: ${JSON.stringify(params)}`;
            throw e;
        }
    }

    private async deleteCategory(ctx: koa.ParameterizedContext, next: () => Promise<any>)
    {
        const params = ctx.request.body;

        if(!params.name) {
            throw new MissingRequiredParametersError(['name']);
        }

        try {
            await this.core.deleteCategory(params.name);

            ctx.status = 204;
        } catch(e) {
            e.message += `\n        Request parameters: ${JSON.stringify(params)}`;
            throw e;
        }
    }
}
