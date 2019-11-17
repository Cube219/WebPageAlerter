import rimraf from "rimraf";
import cheerio from "cheerio"; 
import moment from "moment";
import rq from "request-promise-native";
import { InvalidUrlError } from "./Errors";

export interface WebSiteInfo
{
    _id: string;
    title: string;
    url: string;
    crawlUrl: string;
    cssSelector: string;
    lastUrl: string;
    category: string;
    checkingCycleSec: number;
    isDisabled: boolean;
}

export interface WebPageInfo
{
    _id: string;
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

// export interface requestRes
// {
//     response: request.Response;
//     body: any;
// }

// export function requestPromise(url: string, options?: request.CoreOptions): Promise<requestRes> {
//     return new Promise(function(resolve, reject) {
//         request(url, options, function(err, response, body) {
//             if(err) return reject(err);

//             const res: requestRes = { response, body };
//             resolve(res);
//         });
//     });
// }

export function rimrafPromise(path: string): Promise<void> {
    return new Promise(function(resolve, reject) {
        rimraf(path, function(e) {
            if(e) return reject(e);

            resolve();
        });
    });
}

export function relToAbsUrl(url: string, baseUrl: string)
{
    const absRegex = /^(?:[a-z]+:)?\/\//i;

    if(absRegex.test(url) == true) {
        return url;
    } else {
        const u = new URL(url, baseUrl);
        return u.toString();
    }
}

export async function getPageInfo(pageUrl: string)
{
    let res: any;

    try {
        res = await rq(pageUrl);
    } catch(e) {
        let err = new InvalidUrlError(pageUrl);
        err.message = e.message;

        throw err;
    }

    const $ = cheerio.load(res);
    let selected: Cheerio;

    let title = "";
    selected = $('meta[property="og:title"]');
    if(selected.length != 0) {
        title = selected[0].attribs.content;
    } else {
        selected = $('title');
        if(selected.length != 0) {
            title = selected.text();
        }
    }
    let url = "";
    selected = $('meta[property="og:url"]');
    if(selected.length != 0) {
        url = selected[0].attribs.content;
    } else {
        url = pageUrl;
    }
    let imageUrl = "";
    selected = $('meta[property="og:image"]');
    if(selected.length != 0) {
        imageUrl = selected[0].attribs.content;
    }
    let desc = "";
    selected = $('meta[property="og:description"]');
    if(selected.length != 0) {
        desc = selected[0].attribs.content;
    }
    
    const page: WebPageInfo = {
        _id: "",
        siteId: "",
        siteTitle: "",
        title: title,
        url: url,
        imageUrl: imageUrl,
        desc: desc,
        category: "",
        time: moment().toDate(),
        isRead: false,
        isArchieved: false
    };

    return page;
}

let cachedMajorNum: Number = -1;
let cachedMinorNum: Number;
let cachedPatchNum: Number;
export function isLessAppVersion(major: Number, minor: Number, patch: Number) {
    if(cachedMajorNum == -1) {
        const versionStrs = (process.env.APP_LAST_RUN_VERSION as string).split('.');
        cachedMajorNum = parseInt(versionStrs[0]);
        cachedMinorNum = parseInt(versionStrs[1]);
        cachedPatchNum = parseInt(versionStrs[2]);
    }

    if(cachedMajorNum < major) {
        return true;
    }
    if(cachedMajorNum > major) {
        return false;
    }

    if(cachedMinorNum < minor) {
        return true;
    }
    if(cachedMinorNum > minor) {
        return false;
    }

    if(cachedPatchNum < patch) {
        return true;
    }
    if(cachedPatchNum > patch) {
        return false;
    }

    return false;
}

export function parseBoolean(s: string): boolean | undefined {
    if(s === 'true') {
        return true;
    } else if(s === 'false') {
        return false;
    } else {
        return undefined;
    }
}
