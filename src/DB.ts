import mongoose from "mongoose"
import { WebSiteInfo, WebPageInfo } from "./WebSiteWatcher"
import { resolve } from "dns";
import { rejects } from "assert";

mongoose.Promise = global.Promise;

// Schemas
const webSiteInfo = new mongoose.Schema({
    title: String,
    url: String,
    crawlUrl: String,
    cssSelector: String,
    lastTitle: String,
    category: String
});
interface IWebSiteInfo extends mongoose.Document
{
    title: string;
    url: string;
    crawlUrl: string;
    cssSelector: string;
    lastTitle: string;
    category: string;
}
const WebSiteInfoModel = mongoose.model<IWebSiteInfo>('web_site_info', webSiteInfo);

const savedWebPage = new mongoose.Schema({
    siteId: String,
    title: String,
    url: String,
    imageUrl: String,
    desc: String,
    category: String,
    time: Date,
    isRead: Boolean
});
interface ISavedWebPage extends mongoose.Document
{
    siteId: string;
    title: string;
    url: string;
    imageUrl: string;
    desc: string;
    category: string;
    time: Date;
    isRead: boolean;
}
const SavedWebPageModel = mongoose.model<ISavedWebPage>('saved_web_page', savedWebPage);

interface UpdateWebSiteParams
{
    crawlUrl?: string;
    cssSelector?: string;
    category?: string;
}

interface GetPagesParams
{
    onlyUnread?: boolean;
    category?: string;
    startIndex?: number;
    count?: number;
}

export interface DBInitializer
{
    url: string;
    port: number;
}

class DB
{
    constructor()
    {
    }

    init(init: DBInitializer)
    {
        mongoose.connect(`mongodb://${init.url}:${init.port}/web_page_alerter`, { useNewUrlParser: true });
    }

    shutdown()
    {
        mongoose.disconnect();
    }

    async getWebSites()
    {
        const queryRes = await WebSiteInfoModel.find();

        let res: WebSiteInfo[] = [];
        for(let i in queryRes) {
            const r = queryRes[i];
            
            res[i] = {
                _id: r._id,
                title: r.title,
                url: r.url,
                crawlUrl: r.crawlUrl,
                cssSelector: r.cssSelector,
                lastTitle: r.lastTitle,
                category: r.category
            };
        }

        return res;
    }

    async insertWebSite(info: WebSiteInfo)
    {
        const doc = new WebSiteInfoModel({
            title: info.title,
            url: info.url,
            crawlUrl: info.crawlUrl,
            cssSelector: info.cssSelector,
            lastTitle: info.lastTitle,
            category: info.category
        });
        await doc.save();
    }

    async deleteWebSite(id: string, deleteAllPages: boolean = false)
    {
        if(deleteAllPages == true) {
            await SavedWebPageModel.deleteMany({ siteId: id });
        }

        const res = await WebSiteInfoModel.deleteOne({
            _id: id
        });

        if(res.ok != 1) {
            throw Error();
        }
        
        return res.n;
    }

    async updateWebSite(id: string, params: UpdateWebSiteParams)
    {
        const res = await WebSiteInfoModel.updateOne({ _id: id }, { $set: params });

        if(res.ok != 1) {
            throw Error();
        }

        return res.n;
    }
}

const db = new DB();
export { db as DB }
