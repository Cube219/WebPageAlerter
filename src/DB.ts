import mongoose from "mongoose";
import { WebSiteInfo, WebPageInfo } from "./Utility";
import { Log } from "./Log";

mongoose.Promise = global.Promise;

// Schemas
const webSiteInfo = new mongoose.Schema({
    title: String,
    url: String,
    crawlUrl: String,
    cssSelector: String,
    lastUrl: String,
    category: String,
    checkingCycleSec: Number
});
interface IWebSiteInfo extends mongoose.Document
{
    title: string;
    url: string;
    crawlUrl: string;
    cssSelector: string;
    lastUrl: string;
    category: string;
    checkingCycleSec: number;
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
savedWebPage.index({ time: -1 });
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
const ArchievedWebPageModel = mongoose.model<ISavedWebPage>('archieved_web_page', savedWebPage);

// Function params
interface UpdateWebSiteParams
{
    crawlUrl?: string;
    cssSelector?: string;
    category?: string;
    lastUrl?: string;
    checkingCycleSec?: number;
}

interface UpdatePageParams
{
    isRead?: boolean;
    imageUrl?: string;
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
        Log.info("Started DB.");
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
                lastUrl: r.lastUrl,
                category: r.category,
                checkingCycleSec: r.checkingCycleSec
            };
        }

        return res;
    }

    async getWebSite(id: string)
    {
        const queryRes = await WebSiteInfoModel.find({ _id: id });
        
        const r = queryRes[0];
        const res: WebSiteInfo = {
            _id: r._id,
            title: r.title,
            url: r.url,
            crawlUrl: r.crawlUrl,
            cssSelector: r.cssSelector,
            lastUrl: r.lastUrl,
            category: r.category,
            checkingCycleSec: r.checkingCycleSec
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
            lastUrl: info.lastUrl,
            category: info.category,
            checkingCycleSec: info.checkingCycleSec
        });
        return doc.save();
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
            throw Error("Failed to delete the site in DB.");
        }
        
        return res.n;
    }

    async updateWebSite(id: string, params: UpdateWebSiteParams)
    {
        const res = await WebSiteInfoModel.updateOne({ _id: id }, { $set: params }, { omitUndefined: true });

        if(res.ok != 1) {
            throw Error("Failed to update the site in DB.");
        }

        return res.n;
    }

    async getPages(params: GetPagesParams, fromArchieved: boolean = false)
    {
        let condition: any = {}
        // Archieved pages always be read
        if(params.onlyUnread == true && fromArchieved == false) {
            condition["isRead"] = { $eq: false };
        }
        if(params.category) {
            condition["category"] = { $eq: params.category };
        }

        let query: mongoose.DocumentQuery<ISavedWebPage[], ISavedWebPage>;
        if(fromArchieved == false) {
            query = SavedWebPageModel.find(condition);
        } else {
            query = ArchievedWebPageModel.find(condition);
        }
        if(params.startIndex) {
            query.skip(params.startIndex);
        }
        if(params.count) {
            query.limit(params.count);
        }
        const queryRes = await query.sort({ time: -1 });

        let res: WebPageInfo[] = [];
        for(let i in queryRes) {
            const r = queryRes[i];

            res[i] = {
                _id: r._id,
                siteId: r.siteId,
                title: r.title,
                url: r.url,
                imageUrl: r.imageUrl,
                desc: r.desc,
                category: r.category,
                time: r.time,
                isRead: r.isRead
            };
        }

        return res;
    }

    async getPage(id: string, fromArchieved: boolean = false)
    {
        let queryRes: ISavedWebPage[];
        if(fromArchieved == false) {
            queryRes = await SavedWebPageModel.find({ _id: id });
        } else {
            queryRes = await ArchievedWebPageModel.find({ _id: id });
        }

        const r = queryRes[0];
        const res: WebPageInfo = {
            _id: r._id,
            siteId: r.siteId,
            title: r.title,
            url: r.url,
            imageUrl: r.imageUrl,
            desc: r.desc,
            category: r.category,
            time: r.time,
            isRead: r.isRead
        }

        return res;
    }

    async insertPage(info: WebPageInfo)
    {
        const doc = new SavedWebPageModel({
            siteId: info.siteId,
            title: info.title,
            url: info.url,
            imageUrl: info.imageUrl,
            desc: info.desc,
            category: info.category,
            time: info.time,
            isRead: info.isRead
        });
        return doc.save();
    }

    async archievePage(info: WebPageInfo)
    {
        const doc = new ArchievedWebPageModel({
            siteId: info.siteId,
            title: info.title,
            url: info.url,
            imageUrl: info.imageUrl,
            desc: info.desc,
            category: info.category,
            time: info.time,
            isRead: info.isRead
        });
        return doc.save();
    }

    async deletePage(id: string)
    {
        const res = await SavedWebPageModel.deleteOne({ _id: id });

        if(res.ok == 1 && res.n && res.n > 0) {
            return res.n;
        }

        const res2 = await ArchievedWebPageModel.deleteOne({ _id: id });

        if(res2.ok == 1) {
            return res2.n;
        }
        
        throw Error("Failed to delete the page in DB.");
    }

    async updatePage(id: string, params: UpdatePageParams)
    {
        const res = await SavedWebPageModel.updateOne({ _id: id }, { $set: params }, { omitUndefined: true });

        if(res.ok == 1 && res.n > 0) {
            return res.n;
        }

        const res2 = await ArchievedWebPageModel.updateOne({ _id: id }, { $set: params }, { omitUndefined: true });

        if(res2.ok == 1) {
            return res2.n;
        }

        throw Error("Failed to update the page in DB.");
    }
}

const db = new DB();
export { db as DB }
