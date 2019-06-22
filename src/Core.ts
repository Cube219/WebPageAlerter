import request from "request";
import fs from "fs";
import rimraf from "rimraf";

import { DB } from "./DB";
import { WebSiteWatcher, WebSiteWatcherInitializer, WebSiteInfo, WebPageInfo } from "./WebSiteWatcher";
import { Log } from "./Log";

interface reqRes
{
    response: request.Response;
    body: any;
}
function req(url: string, options?: request.CoreOptions): Promise<reqRes> {
    return new Promise(function(resolve, reject) {
        request(url, options, function(err, response, body) {
            if(err) return reject(err);

            const res: reqRes = { response, body };
            resolve(res);
        });
    });
}

function rimrafPromise(path: string): Promise<void> {
    return new Promise(function(resolve, reject) {
        rimraf(path, function(e) {
            if(e) return reject(e);

            resolve();
        });
    });
}

// Function params
interface UpdateWebSiteParams
{
    crawlUrl?: string;
    cssSelector?: string;
    category?: string;
    lastTitle?: string;
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
            this.watchers.push(new WebSiteWatcher({core: this, info: info, intervalTimeSec: 5 }));
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

            const watcher = new WebSiteWatcher({ core: this, info: info, intervalTimeSec: 5 });
            watcher.run();
            this.watchers.push(watcher);

            Log.info(`Inserted a web site.\n        id: ${info._id} / title: ${info.title} / url: ${info.url}`);
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
                    throw Error(`Cannot find deleted web site in the watchers.\n        Site id: ${id}`);
                }
                this.watchers[index].stop();
                this.watchers.splice(index, 1);

                Log.info(`Deleted the web site.\n        id: ${id}`);
            } else {
                Log.warn(`Tried to delete the page '${id}', but could not find.`);
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
                    throw Error(`Cannot find deleted web site in the watchers.\n        Site id: ${id}`);
                }
                this.watchers[index].stop();
                this.watchers.splice(index, 1);

                const updatedInfo = await DB.getWebSite(id);
                const watcher = new WebSiteWatcher({ core:this, info: updatedInfo, intervalTimeSec: 5 });
                watcher.run();
                this.watchers.push(watcher);

                Log.info(`Updated the web site.\n        id: ${id} / params: ${JSON.stringify(params)}`);
            } else {
                Log.warn(`Tried to update the page '${id}', but could not find.`);
            }
        } catch(e) {
            throw e;
        }
    }

    async getPages(params: GetPagesParams)
    {
        return DB.getPages(params);
    }

    async insertPage(info: WebPageInfo)
    {
        const res = await req(info.imageUrl, {encoding: "binary"});

        const dbRes = await DB.insertPage(info);
        info._id = dbRes._id;

        const dataDirPath = `page_data/${info._id}/`;
        if(fs.existsSync("page_data") == false) {
            await fs.promises.mkdir("page_data");
        }
        if(fs.existsSync(dataDirPath) == false) {
            await fs.promises.mkdir(dataDirPath);
        }
        console.log(res.response.statusCode);
        if(res.response.statusCode == 200) {
            await fs.promises.writeFile(dataDirPath + "image", res.body, "binary");
        }

        await DB.updatePage(info._id as string, { imageUrl: `${info._id}/image` });

        Log.info(`Added a new page. (Site id: ${info.siteId})\n        id: ${info._id} / title: ${info.title}`);
    }

    async deletePage(id: string, withData: boolean = true)
    {
        const info = await DB.getPage(id);

        if(withData) {
            try {
              await rimrafPromise(`page_data/${info._id}`);
            } catch(e) {
                Log.warn(`Failed to delete the page data.\n        id: ${info._id}\n        ${e}`);
            }
        }

        const res = await DB.deletePage(id);

        if(res == 0) {
            Log.warn(`Tried to delete the page '${id}', but could not find.`);
        } else {
            Log.info(`Deleted the page.\n        id: ${info._id} / title: ${info.title}`);
        }
    }
    
    async readPage(id: string)
    {
        const res = await DB.updatePage(id, { isRead: true });
        if(res == 0) {
            Log.warn(`Tried to read the page '${id}', but could not find.`);
        }
    }
}
