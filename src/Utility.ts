import request from "request";
import rimraf from "rimraf";
import cheerio from "cheerio"; 
import moment from "moment";

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
}

export interface WebPageInfo
{
    _id: string;
    siteId: string;
    title: string;
    url: string;
    imageUrl: string;
    desc: string;
    category: string;
    time: Date;
    isRead: boolean;
}

export interface requestRes
{
    response: request.Response;
    body: any;
}

export function requestPromise(url: string, options?: request.CoreOptions): Promise<requestRes> {
    return new Promise(function(resolve, reject) {
        request(url, options, function(err, response, body) {
            if(err) return reject(err);

            const res: requestRes = { response, body };
            resolve(res);
        });
    });
}

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
    const res = await requestPromise(pageUrl);
    
    const $ = cheerio.load(res.body);
    let selected: Cheerio;

    let title = "";
    selected = $('meta[property="og:title"]');
    if(selected.length != 0) {
        title = selected[0].attribs.content
    }
    let url = "";
    selected = $('meta[property="og:url"]');
    if(selected.length != 0) {
        url = selected[0].attribs.content;
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
        title: title,
        url: url,
        imageUrl: imageUrl,
        desc: desc,
        category: "",
        time: moment().toDate(),
        isRead: false
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
    if(cachedMinorNum < minor) {
        return true;
    }
    if(cachedPatchNum < patch) {
        return true;
    }

    return false;
}
