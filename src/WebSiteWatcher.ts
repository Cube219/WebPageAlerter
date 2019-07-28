import cheerio from "cheerio";

import { WebSiteInfo, requestPromise, relToAbsUrl, getPageInfo } from "./Utility";
import { Core } from "./Core";
import { Log } from "./Log";
import { DB } from "./DB";

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
    private failedNum: number;

    constructor(init: WebSiteWatcherInitializer)
    {
        this.core = init.core;
        this.siteInfo = init.info;
        
        this.isBusy = false;
        this.failedNum = 0;
    }

    public run()
    {
        if(this.siteInfo.isDisabled == true) {
            return;
        }

        if(!this.siteInfo.checkingCycleSec) {
            this.siteInfo.checkingCycleSec = 900;

            DB.updateWebSite(this.siteInfo._id, { checkingCycleSec: 900 });
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

        this.checkNewPage().then(() => {
            this.failedNum = 0;
        }).
        catch((e) => {
            Log.error(`WebSiteWatcher: Failed to check a new page.\n        Site id: ${this.siteInfo._id}(${this.siteInfo.title})\n        ${e.stack}`);

            this.isBusy = false;

            this.failedNum += 1;
            if(this.failedNum >= 10) {
                Log.error(`WebSiteWatcher: Failed to check a new page 10 times continuously, so disable this web site.\n        Site id: ${this.siteInfo._id}(${this.siteInfo.title})`);
                Log.error('WebSiteWatcher: Check the logs for fixing errors and enable it manually, or delete it.');
                this.core.updateWebSite(this.siteInfo._id, { isDisabled: true });
            }
        });
    }

    private async checkNewPage()
    {
        this.isBusy = true;

        const res = await requestPromise(this.siteInfo.crawlUrl);

        const $ = cheerio.load(res.body);
        const aElement = $(this.siteInfo.cssSelector)[0];

        const pageUrl = relToAbsUrl(aElement.attribs.href, this.siteInfo.url);
        
        if(this.siteInfo.lastUrl != pageUrl) {
            await this.savePage(pageUrl);
        }

        this.isBusy = false;
    }

    private async savePage(pageUrl: string)
    {
        const info = await getPageInfo(pageUrl);
        info.siteId = this.siteInfo._id;
        info.category = this.siteInfo.category;

        await this.core.insertPage(info);

        this.siteInfo.lastUrl = pageUrl;
    }
}
