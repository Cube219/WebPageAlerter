import request from "request";
import cheerio from "cheerio"; 
import moment from "moment";
import url from "url";

import { Core } from "./Core";
import { Log } from "./Log";

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
    intervalTimeSec: number;
}

export class WebSiteWatcher
{
    private core: Core;
    private siteInfo: WebSiteInfo;
    private intervalTimeSec: number;

    private intervalId?: NodeJS.Timeout;
    private isBusy: boolean;

    constructor(init: WebSiteWatcherInitializer)
    {
        this.core = init.core;
        this.siteInfo = init.info;
        this.intervalTimeSec = init.intervalTimeSec;
        
        this.isBusy = false;
    }

    public run()
    {
        this.intervalId = setInterval(this.runInternal.bind(this), this.intervalTimeSec * 1000);
    }

    public stop()
    {
        if(this.intervalId) {
            clearTimeout(this.intervalId);
        }
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

        const title = $('meta[property="og:title"]')[0].attribs.content;
        const url = $('meta[property="og:url"]')[0].attribs.content;
        const imageUrl = $('meta[property="og:image"]')[0].attribs.content;
        const desc = $('meta[property="og:description"]')[0].attribs.content;

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
