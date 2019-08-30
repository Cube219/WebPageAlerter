export class WPAError extends Error {
    statusCode: number;
    responseMessage: string;

    constructor(message: string, statusCode: number) {
        super(message);
        
        this.statusCode = statusCode;
        this.responseMessage = message;
    }
}

export class SiteNotFoundError extends WPAError {
    id: string;

    constructor(id: string) {
        super(`Site not found (id: ${id})`, 404); // 404: Not Found
        this.name = 'SiteNotFoundError';
        Object.setPrototypeOf(this, SiteNotFoundError.prototype);

        this.id = id;
    }
}

export class InvalidSiteCrawlUrlError extends WPAError {
    crawlUrl: string;

    constructor(crawlUrl: string) {
        super('Invalid site crawl url', 400);
        this.name = 'InvalidSiteCrawlUrlError';
        Object.setPrototypeOf(this, InvalidSiteCrawlUrlError.prototype);

        this.crawlUrl = crawlUrl;
    }
}

export class InvalidCssSelectorError extends WPAError {
    cssSelector: string;

    constructor(cssSelector: string) {
        super('Invalid CSS selector', 400);
        this.name = 'InvalidCssSelectorError';
        Object.setPrototypeOf(this, InvalidCssSelectorError.prototype);

        this.cssSelector = cssSelector;
    }
}

export class PageNotFoundError extends WPAError {
    id: string;

    constructor(id: string) {
        super(`Page not found (id: ${id})`, 404);
        this.name = 'PageNotFoundError';
        Object.setPrototypeOf(this, PageNotFoundError.prototype);

        this.id = id;
    }
}

export class InvalidPageUrlError extends WPAError {
    url: string;

    constructor(url: string) {
        super(`Invalid page url`, 400);
        this.name = 'InvalidPageUrlError';
        Object.setPrototypeOf(this, InvalidPageUrlError.prototype);

        this.url = url;
    }
}

export class MissingRequiredParametersError extends WPAError {
    missingParams: string[];

    constructor(missingParams: string[]) {
        super(`Missing required parameters (${missingParams.join(', ')})`, 400);
        this.name = 'MissingRequiredParametersError';
        Object.setPrototypeOf(this, MissingRequiredParametersError.prototype);

        this.missingParams = missingParams;
    }
}

// TODO: 나중에 구현
// export class InvalidParametersError extends WPAError {
// }

export class UnauthorizedError extends WPAError {
    constructor() {
        super('Unauthorized', 401);
        this.name = 'UnauthorizedError';
        Object.setPrototypeOf(this, UnauthorizedError.prototype);
    }
}

// export class TokenExpiredError extends WPAError {
//     constructor() {
//         super('Token expired', 401);
//     }
// }

// export class InvalidTokenError extends WPAError {
//     constructor() {
//         super('Invalid token', 401);
//     }
// }
