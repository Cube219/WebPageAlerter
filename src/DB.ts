import mongoose, { PromiseProvider } from "mongoose";
import { WebSiteInfo, WebPageInfo, isLessAppVersion } from "./Utility";
import { Log } from "./Log";
import { CategoryNotFoundError, AlreadyExistedError } from "./Errors";

mongoose.Promise = global.Promise;

// Schemas
const appInfo = new mongoose.Schema({
    lastRunVersion: String
});
interface IAppInfo extends mongoose.Document
{
    lastRunVersion: string;
}
const AppInfoModel = mongoose.model<IAppInfo>('app_info', appInfo);

const webSiteInfo = new mongoose.Schema({
    title: String,
    url: String,
    crawlUrl: String,
    cssSelector: String,
    lastUrl: String,
    category: String,
    checkingCycleSec: Number,
    isDisabled: Boolean
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
    isDisabled: boolean;
}
const WebSiteInfoModel = mongoose.model<IWebSiteInfo>('web_site_info', webSiteInfo);

const savedWebPage = new mongoose.Schema({
    siteId: String,
    siteTitle: String,
    title: String,
    url: String,
    imageUrl: String,
    desc: String,
    category: String,
    time: Date,
    isRead: Boolean,
    isArchieved: Boolean
});
savedWebPage.index({ time: -1 });
interface ISavedWebPage extends mongoose.Document
{
    siteId: string;
    siteTitle: string;
    title: string;
    url: string;
    imageUrl: string;
    desc: string;
    category: string;
    time: Date;
    isRead: boolean;
    isArchieved: boolean;
}
const SavedWebPageModel = mongoose.model<ISavedWebPage>('saved_web_page', savedWebPage);
const ArchievedWebPageModel = mongoose.model<ISavedWebPage>('archieved_web_page', savedWebPage);

const categoryInfo = new mongoose.Schema({
    name: String
});
interface ICategoryInfo extends mongoose.Document
{
    name: string;
}
const CategoryInfoModel = mongoose.model<ICategoryInfo>('category_info', categoryInfo);

// Function params
interface UpdateWebSiteParams
{
    crawlUrl?: string;
    cssSelector?: string;
    category?: string;
    lastUrl?: string;
    checkingCycleSec?: number;
    isDisabled?: boolean;
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
    categoryWithSub?: boolean;
    startIndex?: number;
    afterId?: string;
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

    async init(init: DBInitializer)
    {
        if(init.url == undefined) {
            init.url = "localhost"
        }
        if(isNaN(init.port)) {
            init.port = 27017;
        }

        await mongoose.connect(`mongodb://${init.url}:${init.port}/web_page_alerter`, { useNewUrlParser: true });

        const appInfoRes = await AppInfoModel.findOne();
        if(appInfoRes) {
            process.env.APP_LAST_RUN_VERSION = appInfoRes.lastRunVersion;
        } else {
            process.env.APP_LAST_RUN_VERSION = "0.0.0";
        }

        const updateRes = await AppInfoModel.updateOne(
            {},
            { $set: { lastRunVersion: process.env.APP_VERSION } },
            { upsert: true }
        );
        if(updateRes.ok != 1 || updateRes.n != 1) {
            throw Error("Failed to update the last run app version.");
        }

        if(isLessAppVersion(0, 1, 6) == true) {
            await this.updateVersion_0_1_6();
        }
        if(isLessAppVersion(0, 1, 8) == true) {
            await this.updateVersion_0_1_8();
        }
        if(isLessAppVersion(0, 1, 10) == true) {
            await this.updateVersion_0_1_10();
        }
        if(isLessAppVersion(0, 3, 0) == true) {
            await this.updateVersion_0_3_0();
        }

        Log.info(`Started DB. (${init.url}:${init.port})`);
    }

    async updateVersion_0_1_6() {
        // v0.1.6: Added isArchieved in savedWebPage schema
        let res = await SavedWebPageModel.updateMany({}, { $set: { isArchieved: false } });
        if(res.ok != 1) {
            throw Error("Failed to update version to 0.1.6.");
        }

        res = await ArchievedWebPageModel.updateMany({}, { $set: { isArchieved: true } });
        if(res.ok != 1) {
            throw Error("Failed to update version to 0.1.6.");
        }

        Log.info("DB: Updated version to 0.1.6 (Added isArchieved in savedWebPage schema)");
    }
    async updateVersion_0_1_8() {
        // v0.1.8: Added isDisabled in webSiteInfo schema
        const res = await WebSiteInfoModel.updateMany({}, { $set: { isDisabled: false } });
        if(res.ok != 1) {
            throw Error("Failed to update version to 0.1.8.");
        }

        Log.info("DB: Updated version to 0.1.8 (Added isDisabled in webSiteInfo schema)");
    }
    async updateVersion_0_1_10() {
        // v0.1.10: Added siteTitle in savedWebPage schema
        const webSites: WebSiteInfo[] = await this.getWebSites();
        const webPages: WebPageInfo[] = await this.getPages({}, false);
        const archievedWebPages: WebPageInfo[] = await this.getPages({}, true);

        const addSiteTitle = async (e: WebPageInfo) => {
            const findSite = webSites.find((e2) => { return e2._id == e.siteId; });

            let res;
            if(findSite) {
                res = await SavedWebPageModel.updateOne({ _id: e._id }, { $set: { siteTitle: findSite.title } });
            } else {
                res = await SavedWebPageModel.updateOne({ _id: e._id }, { $set: { siteTitle: "" } });
            }
            if(res.ok != 1) {
                throw Error("Failed to update version to 0.1.10.");
            }
        };
        const addSiteTitle_archieved = async (e: WebPageInfo) => {
            const findSite = webSites.find((e2) => { return e2._id == e.siteId; });

            let res;
            if(findSite) {
                res = await ArchievedWebPageModel.updateOne({ _id: e._id }, { $set: { siteTitle: findSite.title } });
            } else {
                res = await ArchievedWebPageModel.updateOne({ _id: e._id }, { $set: { siteTitle: "" } });
            }
            if(res.ok != 1) {
                throw Error("Failed to update version to 0.1.10.");
            }
        };

        await Promise.all(webPages.map(async (e) => {
            await addSiteTitle(e);
        }));
        await Promise.all(archievedWebPages.map(async (e) => {
            await addSiteTitle_archieved(e);
        }));

        Log.info("DB: Updated version to 0.1.10 (Added siteTitle in savedWebPage schema)");
    }
    async updateVersion_0_3_0() {
        // v0.3.0: Created category collection
        let categoryList: string[] = [];

        const webSites: WebSiteInfo[] = await this.getWebSites();
        const webPages: WebPageInfo[] = await this.getPages({}, false);
        const archievedWebPages: WebPageInfo[] = await this.getPages({}, true);


        const extractCategory = (e: any) => {
            const category = e.category;
            
            let isExisted: boolean = false;
            for (const it of categoryList) {
                if(it === category) {
                    isExisted = true;
                    break;
                }
            }

            if(isExisted == false) {
                categoryList.push(category);
            }
        };
        webSites.forEach(extractCategory);
        webPages.forEach(extractCategory);
        archievedWebPages.forEach(extractCategory);

        await Promise.all(categoryList.map(async (e) => {
            await this.insertCategory(e, true);
        }));

        Log.info("DB: Updated version to 0.3.0 (Created category collection)");
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
            
            res[i] = r;
        }

        return res;
    }

    async getWebSite(id: string)
    {
        const queryRes = await WebSiteInfoModel.find({ _id: id });
        
        const r = queryRes[0];
        const res: WebSiteInfo = r;

        return res;
    }

    async insertWebSite(info: WebSiteInfo)
    {
        const infoWithout_id: any = info;
        infoWithout_id._id = undefined;

        const doc = new WebSiteInfoModel(infoWithout_id);

        this.insertCategory(info.category, true);

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
            if(params.categoryWithSub != undefined && params.categoryWithSub == false) {
                condition["category"] = { $eq: params.category };
            } else {
                condition["category"] = { $regex: new RegExp(`${params.category}.*`) };
            }
        }

        let query: mongoose.DocumentQuery<ISavedWebPage[], ISavedWebPage>;
        if(fromArchieved == false) {
            query = SavedWebPageModel.find(condition);
        } else {
            query = ArchievedWebPageModel.find(condition);
        }
        if(params.afterId) {
            query.where("_id").lt(params.afterId);
        } else if(params.startIndex) {
            query.skip(params.startIndex);
        }
        if(params.count) {
            query.limit(params.count);
        }
        const queryRes = await query.sort({ _id: -1 });

        let res: WebPageInfo[] = [];
        for(let i in queryRes) {
            const r = queryRes[i];

            res[i] = r;
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

        const res: WebPageInfo = queryRes[0];

        return res;
    }

    async insertPage(info: WebPageInfo)
    {
        info.isArchieved = false;
        const infoWithout_id: any = info;
        infoWithout_id._id = undefined;

        const doc = new SavedWebPageModel(infoWithout_id);

        this.insertCategory(info.category, true);

        return doc.save();
    }

    async archievePage(info: WebPageInfo)
    {
        info.isArchieved = true;
        let infoWithout_id: any = JSON.parse(JSON.stringify(info));
        infoWithout_id._id = undefined;

        const doc = new ArchievedWebPageModel(infoWithout_id);

        this.insertCategory(info.category, true);

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

    async getCategory(name: string)
    {
        const queryRes = await CategoryInfoModel.findOne({ name: name });

        if(queryRes == null) {
            return null;
        } else {
            return queryRes.name;
        }
    }

    async getCategoriesWithSub(name: string)
    {
        // TODO: name 오름차순으로 출력

        const queryRes = await CategoryInfoModel.find({ name: new RegExp(`${name}.*`) });

        let res: string[] = [];
        for(var i in queryRes) {
            res.push(queryRes[i].name);
        }

        return res;
    }

    async insertCategory(name: string, ignoreIfExisted: boolean = false)
    {
        const queryRes = await CategoryInfoModel.findOne({ name: name });
        if(queryRes != null) {
            if(!ignoreIfExisted) {
                throw new AlreadyExistedError(name);
            } else {
                return undefined;
            }
        }

        const doc = new CategoryInfoModel({ name: name });
        return doc.save();
    }

    async deleteCategory(name: string)
    {
        const res = await CategoryInfoModel.deleteOne({ name: name });

        if(res.ok == 1) {
            return res.n;
        }

        throw Error("Failed to delete the category in DB.");
    }
}

const db = new DB();
export { db as DB }
