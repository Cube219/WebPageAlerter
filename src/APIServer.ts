import express from "express";
import bodyParser from "body-parser";

import http from "http";
import http2 from "http2";
import spdy from "spdy";

import fs from "fs";

export interface APIServerInitializer
{
    port: number;
    keyPath: string;
    certPath: string;
}

export class APIServer
{
    private expressApp: express.Express;
    private port: number;

    private spdyServer: spdy.Server;
    private httpServer: http.Server;

    constructor(init: APIServerInitializer)
    {
        this.port = init.port;

        this.expressApp = express();

        this.expressApp.use(bodyParser.urlencoded({ extended: false}));

        const options = {
            key: fs.readFileSync(init.keyPath),
            cert: fs.readFileSync(init.certPath)
        }
        // http2.createSecureServer(options, this.expressApp).listen(this.port);
        this.spdyServer = spdy.createServer(options, this.expressApp);
        // Redirect from http to https
        this.httpServer = http.createServer(function(req, res) {
            res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
            res.end();
        });
    }

    start()
    {
        this.spdyServer.listen(443);
        this.httpServer.listen(80);
    }

    stop()
    {
        this.spdyServer.close();
        this.httpServer.close();
    }
}
