export interface WebSiteInfo
{
    _id?: string;
    title: string;
    url: string;
    crawlUrl: string;
    cssSelector: string;
    lastTitle: string;
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
    info: WebSiteInfo;
    intervalTimeSec: number;
}

export class WebSiteWatcher
{
    private siteInfo: WebSiteInfo;
    private intervalTimeSec: number;

    private events: Array<(info:WebPageInfo) => void>;
    private intervalId?: NodeJS.Timeout;

    constructor(init: WebSiteWatcherInitializer)
    {
        this.siteInfo = init.info;
        this.intervalTimeSec = init.intervalTimeSec;

        this.events = Array<(info:WebPageInfo) => void>();
    }

    public registerNewPageAlert(eventFunc: (info: WebPageInfo) => void)
    {
        this.events.push(eventFunc);
    }

    public run()
    {
        this.intervalId = setInterval(this.runInternal, this.intervalTimeSec * 1000);
    }

    public stop()
    {
        if(this.intervalId) {
            clearTimeout(this.intervalId);
        }
    }

    private runInternal()
    {
        console.log("Run Internal");
    }
}
