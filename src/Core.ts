import fs from "fs";
import rq from "request-promise-native";
import cheerio from "cheerio";

import { WebSiteInfo, WebPageInfo, rimrafPromise, relToAbsUrl, getPageInfo } from "./Utility";
import { DB } from "./DB";
import { WebSiteWatcher, WebSiteWatcherInitializer } from "./WebSiteWatcher";
import { Log } from "./Log";
import { SiteNotFoundError, PageNotFoundError, InvalidUrlError, InvalidCssSelectorError } from "./Errors";

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

interface GetPagesParams
{
    onlyUnread?: boolean;
    category?: string;
    startIndex?: number;
    afterId?: string;
    count?: number;
}

export class Core
{
    private watchers: WebSiteWatcher[] = [];

    constructor()
    {
    }

    async init()
    {
        const infos = await DB.getWebSites();

        infos.forEach(info => {
            this.watchers.push(new WebSiteWatcher({core: this, info: info }));
        });
    }

    start()
    {
        this.watchers.forEach(w => {
            w.run();
        });

        Log.info(`Started Core. (Num of watchers: ${this.watchers.length})`);
    }

    async getWebSites()
    {
        return await DB.getWebSites();
    }

    async insertWebSite(info: WebSiteInfo)
    {
        try {
            await this.verifySite(info);

            const resId = (await DB.insertWebSite(info))._id;
            info._id = resId;

            const watcher = new WebSiteWatcher({ core: this, info: info });
            watcher.run();
            this.watchers.push(watcher);

            Log.info(`Core: Inserted a web site.\n        id: ${info._id} / title: ${info.title} / url: ${info.url}`);

            watcher.checkImmediately();
        } catch(e) {
            throw e;
        }
    }

    async deleteWebSite(id: string, deleteAllPages: boolean = false)
    {
        try {
            const res = await DB.deleteWebSite(id, deleteAllPages);

            if(res != 0) {
                const index = this.watchers.findIndex((e)=>{
                    return e.getSiteId() == id;
                });

                if(index == -1) {
                    throw Error(`Core: Cannot find deleted web site in the watchers.\n        Site id: ${id}`);
                }
                this.watchers[index].stop();
                this.watchers.splice(index, 1);

                Log.info(`Core: Deleted the web site.\n        id: ${id}`);
            } else {
                throw new SiteNotFoundError(id);
            }
        } catch(e) {
            throw e;
        }
    }

    async updateWebSite(id: string, params: UpdateWebSiteParams)
    {
        try {
            const res = await DB.updateWebSite(id, params);

            if(res != 0) {
                const index = this.watchers.findIndex((e)=>{
                    return e.getSiteId() == id;
                });

                if(index == -1) {
                    throw Error(`Core: Cannot find deleted web site in the watchers.\n        Site id: ${id}`);
                }
                this.watchers[index].stop();
                this.watchers.splice(index, 1);

                const updatedInfo = await DB.getWebSite(id);
                const watcher = new WebSiteWatcher({ core:this, info: updatedInfo });
                watcher.run();
                this.watchers.push(watcher);

                Log.info(`Core: Updated the web site.\n        id: ${id} / params: ${JSON.stringify(params)}`);
            } else {
                throw new SiteNotFoundError(id);
            }
        } catch(e) {
            throw e;
        }
    }

    async getPages(params: GetPagesParams, fromArchieved: boolean = false)
    {
        return DB.getPages(params, fromArchieved);
    }

    async insertPage(info: WebPageInfo)
    {
        const dbRes = await DB.insertPage(info);
        info._id = dbRes._id;

        let newImagePath:string;
        try {
            const imageData = await rq(info.imageUrl, {encoding: "binary"});
            newImagePath = await this.saveImage(info._id, info.imageUrl, imageData);
        } catch (e) {
            newImagePath = "";
        }

        await Promise.all([
            DB.updatePage(info._id, { imageUrl: newImagePath }),
            DB.updateWebSite(info.siteId, { lastUrl: info.url })
        ]);

        Log.info(`Core: Added a new page. (Site id: ${info.siteId})\n        id: ${info._id} / title: ${info.title}`);
    }

    async archievePage(id: string)
    {
        const info = await DB.getPage(id);
        if(info == undefined) {
            throw new PageNotFoundError(id);
        }

        info.isRead = true;

        const newInfoId = (await DB.archievePage(info))._id;

        if(info.imageUrl != "") {
            const fileName = info.imageUrl.split('/').pop();

            let newPath = `page_data/${newInfoId}/`;
            if(fs.existsSync("page_data") == false) {
                await fs.promises.mkdir("page_data");
            }
            if(fs.existsSync(newPath) == false) {
                await fs.promises.mkdir(newPath);
            }

            newPath += fileName;

            await Promise.all([
                fs.promises.copyFile(info.imageUrl, newPath),
                DB.updatePage(newInfoId, { imageUrl: newPath })
            ]);
        } else {
            await DB.updatePage(newInfoId, { imageUrl: "" });
        }

        Log.info(`Core: Archieved the page.\n        id: ${info._id} / title: ${info.title}`);
    }

    async archieveNewPage(info: WebPageInfo)
    {
        const dbRes = await DB.insertPage(info);
        info._id = dbRes._id;

        let newImagePath:string;
        try {
            const imageData = await rq(info.imageUrl, {encoding: "binary"});
            newImagePath = await this.saveImage(info._id, info.imageUrl, imageData);
        } catch (e) {
            newImagePath = "";
        }

        await DB.updatePage(info._id, { imageUrl: newImagePath });

        Log.info(`Core: Archieved a new page.\n        id: ${info._id} / title: ${info.title}`);
    }

    async deletePage(id: string, withData: boolean = true)
    {
        if(withData) {
            try {
              await rimrafPromise(`page_data/${id}`);
            } catch(e) {
                Log.warn(`Core: Failed to delete the page data.\n        id: ${id}\n        ${e}`);
            }
        }

        const res = await DB.deletePage(id);

        if(res == 0) {
            throw new PageNotFoundError(id);
        } else {
            Log.info(`Core: Deleted the page.\n        id: ${id}`);
        }
    }
    
    async readPage(id: string, setUnread: boolean = false)
    {
        if(setUnread == false) {
            const res = await DB.updatePage(id, { isRead: true });
            if(res == 0) {
                throw new PageNotFoundError(id);
            }
        } else {
            const res = await DB.updatePage(id, { isRead: false });
            if(res == 0) {
                throw new PageNotFoundError(id);
            }
        }
    }

    private async verifySite(info: WebSiteInfo)
    {
        let res: any;
        try {
            res = await rq(info.crawlUrl);
        } catch(e) {
            let err = new InvalidUrlError(info.crawlUrl);
            err.message = e.message;

            throw err;
        }

        try {
            const $ = cheerio.load(res);
            const aElement = $(info.cssSelector)[0];

            const pageUrl = relToAbsUrl(aElement.attribs.href, info.url);
        } catch(e) {
            let err = new InvalidCssSelectorError(info.cssSelector);
            err.message = e.message;

            throw err;
        }
    }

    private async saveImage(id: string, oldPath: string, imageData: any)
    {
        const dataDirPath = `page_data/${id}/`;
        if(fs.existsSync("page_data") == false) {
            await fs.promises.mkdir("page_data");
        }
        if(fs.existsSync(dataDirPath) == false) {
            await fs.promises.mkdir(dataDirPath);
        }
        
        let imagePath: string = "";
        const fileExtension = oldPath.match(/\.\w{3,4}($|\?)/i);
        if(fileExtension) {
            imagePath = dataDirPath + "image" + fileExtension[0];
        } else {
            imagePath = dataDirPath + "image";
        }

        await fs.promises.writeFile(imagePath, imageData, "binary");

        return imagePath;
    }
}
