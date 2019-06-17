import { DB } from "./DB";
import { WebSiteWatcher, WebSiteWatcherInitializer, WebSiteInfo, WebPageInfo } from "./WebSiteWatcher";
import { Log } from "./Log";

// Function params
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
            this.watchers.push(new WebSiteWatcher({ info: info, intervalTimeSec: 5 }));
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

            const watcher = new WebSiteWatcher({ info: info, intervalTimeSec: 5 });
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
                    return e.getId() == id;
                });

                if(index == -1) {
                    throw Error(`Cannot find deleted web site in the watchers.\n        Site id: ${id}`);
                }
                this.watchers[index].stop();
                this.watchers.splice(index, 1);

                Log.info(`Deleted the web site.\n        id: ${id}`);
            }

            return res;
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
                    return e.getId() == id;
                });

                if(index == -1) {
                    throw Error(`Cannot find deleted web site in the watchers.\n        Site id: ${id}`);
                }
                this.watchers[index].stop();
                this.watchers.splice(index, 1);

                const updatedInfo = await DB.getWebSite(id);
                const watcher = new WebSiteWatcher({ info: updatedInfo, intervalTimeSec: 5 });
                watcher.run();
                this.watchers.push(watcher);

                Log.info(`Updated the web site.\n        id: ${id} / params: ${JSON.stringify(params)}`);
            }

            return res;
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
        return DB.insertPage(info);
    }

    async deletePage(id: string)
    {
        return DB.deletePage(id);
    }
    
    async readPage(id: string)
    {
        return DB.readPage(id);
    }
}
