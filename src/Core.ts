import fs from "fs";

import { WebSiteInfo, WebPageInfo, requestRes, requestPromise, rimrafPromise } from "./Utility";
import { DB } from "./DB";
import { WebSiteWatcher, WebSiteWatcherInitializer } from "./WebSiteWatcher";
import { Log } from "./Log";

// Function params
interface UpdateWebSiteParams
{
    crawlUrl?: string;
    cssSelector?: string;
    category?: string;
    lastUrl?: string;
}

interface GetPagesParams
{
    onlyUnread?: boolean;
    category?: string;
    startIndex?: number;
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
                Log.warn(`Core: Tried to delete the page '${id}', but could not find.`);
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
                Log.warn(`Core: Tried to update the page '${id}', but could not find.`);
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
            const imageRes = await requestPromise(info.imageUrl, {encoding: "binary"});
            newImagePath = await this.saveImage(info._id, imageRes);
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
        const fileName = info.imageUrl.split('/').pop();
        info.isRead = true;

        const newInfoId = (await DB.archievePage(info))._id;

        let newPath = `page_data/${newInfoId}/`;
        if(fs.existsSync("page_data") == false) {
            await fs.promises.mkdir("page_data");
        }
        if(fs.existsSync(newPath) == false) {
            await fs.promises.mkdir(newPath);
        }

        newPath += fileName;

        if(info.imageUrl != "") {
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
            const imageRes = await requestPromise(info.imageUrl, {encoding: "binary"});
            newImagePath = await this.saveImage(info._id, imageRes);
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
            Log.warn(`Core: Tried to delete the page '${id}', but could not find.`);
        } else {
            Log.info(`Core: Deleted the page.\n        id: ${id}`);
        }
    }
    
    async readPage(id: string)
    {
        const res = await DB.updatePage(id, { isRead: true });
        if(res == 0) {
            Log.warn(`Core: Tried to read the page '${id}', but could not find.`);
        }
    }

    private async saveImage(id: string, imageRes: requestRes)
    {
        const dataDirPath = `page_data/${id}/`;
        if(fs.existsSync("page_data") == false) {
            await fs.promises.mkdir("page_data");
        }
        if(fs.existsSync(dataDirPath) == false) {
            await fs.promises.mkdir(dataDirPath);
        }
        
        const oldPath = imageRes.response.request.uri.href;
        let imagePath: string = "";
        if(imageRes.response.statusCode == 200) {
            const fileExtension = oldPath.match(/\.\w{3,4}($|\?)/i);
            if(fileExtension) {
                imagePath = dataDirPath + "image" + fileExtension[0];
            } else {
                imagePath = dataDirPath + "image";
            }

            await fs.promises.writeFile(imagePath, imageRes.body, "binary");
        }

        return imagePath;
    }
}
