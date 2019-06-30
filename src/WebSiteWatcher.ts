import request from "request";
import cheerio from "cheerio"; 
import moment from "moment";
import url from "url";

import { Core } from "./Core";
import { Log } from "./Log";
import { DB } from "./DB";

function req(url: string, options?: request.CoreOptions): Promise<any> {
    return new Promise(function(resolve, reject) {
        request(url, options, function(err, response, body) {
            if(err) return reject(err);

            resolve(body);
        });
    });
}

export interface WebSiteInfo
{
    _id?: string;
    title: string;
    url: string;
    crawlUrl: string;
    cssSelector: string;
    lastUrl: string;
    category: string;
    checkingCycleSec: number;
}

export interface WebPageInfo
{
    _id?: string;
    siteId: string;
    title: string;
    url: string;
    imageUrl: string;
    desc: string;
    category: string;
    time: Date;
    isRead: boolean;
}

export interface WebSiteWatcherInitializer
{
    core: Core;
    info: WebSiteInfo;
}

export class WebSiteWatcher
{
    private core: Core;
    private siteInfo: WebSiteInfo;

    private intervalId?: NodeJS.Timeout;
    private isBusy: boolean;

    constructor(init: WebSiteWatcherInitializer)
    {
        this.core = init.core;
        this.siteInfo = init.info;
        
        this.isBusy = false;
    }

    public run()
    {
        if(!this.siteInfo.checkingCycleSec) {
            this.siteInfo.checkingCycleSec = 900;

            DB.updateWebSite(this.siteInfo._id as string, { checkingCycleSec: 900 });
        }

        // Delay checking when initialized
        // because of preventing checking many sites at same time
        const delayTimeSec = Math.random() * this.siteInfo.checkingCycleSec;
        this.intervalId = setTimeout(this.checkImmediately.bind(this), delayTimeSec * 1000);
    }

    public stop()
    {
        if(this.intervalId) {
            clearTimeout(this.intervalId);
        }
    }

    public checkImmediately()
    {
        if(this.intervalId) {
            clearTimeout(this.intervalId);
        }

        this.runInternal();

        this.intervalId = setInterval(this.runInternal.bind(this), this.siteInfo.checkingCycleSec * 1000);
    }

    public getSiteId()
    {
        return this.siteInfo._id;
    }

    private runInternal()
    {
        if(this.isBusy == true)
            return;

        // TODO: 검사 중에는 다 끝날때까지 대기
        this.checkNewPage().catch((e) => {
            Log.error(`Failed to check a new page.\n        ${e.stack}`);

            this.isBusy = false;
        });
    }

    private async checkNewPage()
    {
        this.isBusy = true;

        const res = await req(this.siteInfo.crawlUrl);

        const $ = cheerio.load(res);
        const aElement = $(this.siteInfo.cssSelector)[0];

        const pageUrl = this.relToAbs(aElement.attribs.href);
        
        if(this.siteInfo.lastUrl != pageUrl) {
            await this.savePage(pageUrl);
        }

        this.isBusy = false;
    }

    private async savePage(pageUrl: string)
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
            siteId: this.siteInfo._id as string,
            title: title,
            url: url,
            imageUrl: imageUrl,
            desc: desc,
            category: this.siteInfo.category,
            time: moment().toDate(),
            isRead: false
        };

        await this.core.insertPage(page);

        this.siteInfo.lastUrl = pageUrl;
    }

    private relToAbs(url: string)
    {
        const absRegex = /^(?:[a-z]+:)?\/\//i;

        if(absRegex.test(url) == true) {
            return url;
        } else {
            const u = new URL(url, this.siteInfo.url);
            return u.toString();
        }
    }
}
