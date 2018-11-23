// Copyright © 2018 CA. All rights reserved.  CA Confidential.  Please see License.txt file for applicable usage rights and restrictions.
import express = require("express");
import {Path, POST, Server} from "typescript-rest";
import {createHash} from "crypto";
import WriteStream = NodeJS.WriteStream;
import {PublishAction, Request, ResultStatus} from "./ts-action-service";
import * as os from "os";
import {ForbiddenError} from "typescript-rest/dist/server-errors";
import * as path from "path";
import fs = require("fs");
import http = require("http");
import https = require("https");

type WriteFunction = (chunk: any, encoding: string, callback: Function) => void;

class StreamWrap {
    stream: WriteStream;
    origFunc: WriteFunction | null = null;
    alias: "out" | "err";
    log: LogLine[] = [];

    constructor(stream: WriteStream, log: LogLine[]) {
        this.stream = stream;
        this.alias = stream === process.stdout ? "out" : "err";
        this.log = log;
    }

    wrap() {
        if (this.origFunc) throw new Error("Alrady wrapped. Cannot wrap again.");

        this.origFunc = this.stream._write;
        this.stream._write = (chunk: any, encoding: string, callback: Function) => {
            let s: string;
            if (chunk instanceof Buffer)
                s = chunk.toString(encoding);
            else
                s = String(chunk);
            this.log.push({stream: this.alias, msg: s});
            this.origFunc!.call(this.stream, chunk, encoding, callback);
        };
    }

    unwrap() {
        if (!this.origFunc) throw new Error("Not wrapped previously. Cannot unwrap");

        this.stream._write = this.origFunc;
        this.origFunc = null;
    }
}

class MultiStreamWrap {
    wraps: Map<WriteStream, StreamWrap> = new Map();
    log: LogLine[] = [];

    constructor(streams: WriteStream[]) {
        for (let stream of streams) {
            this.wraps.set(stream, new StreamWrap(stream, this.log));
        }
    }

    wrap() {
        for (let w of this.wraps.values()) {
            w.wrap();
        }
    }

    unwrap() {
        for (let w of this.wraps.values()) {
            w.unwrap();
        }
    }
}

interface LogLine {
    stream: "out" | "err";
    msg: string;
}

interface Response {
    status: "SUCCESS" | "FAILED";
    log: LogLine[];
}

@Path("/action")
class ActionService {
    static publishAction: PublishAction;
    static secret: string;

    static logErroAndUnwrap(error: any, wrap: MultiStreamWrap) {
        console.error("Action failed: " + error.message);
        console.error(error);
        try {
            wrap.unwrap();
        } catch (error) {
            console.log("Cannot unwrap:", error);
        }
    }

    @POST
    callAction(req: Request): Promise<Response | Promise<Response>> {
        console.log(`Called from ${req.tdmUrl}. Job ${req.jobTitle}:${req.jobId}`);
        if (req.secret !== ActionService.hasher(ActionService.secret)) {
            let message = `Call from ${req.tdmUrl} rejected: wrong secret. Job ${req.jobTitle}:${req.jobId}`;
            console.error(message);
            throw new ForbiddenError(message);
        }
        return new Promise((resolve) => {
            let wrap = new MultiStreamWrap([process.stdout, process.stderr]);
            try {
                wrap.wrap();
                let ret = ActionService.publishAction(req);
                if (ret instanceof Promise) {
                    ret.then((value) => {
                        resolve({status: value, log: wrap.log});
                        wrap.unwrap();
                    }).catch((reason) => {
                        ActionService.logErroAndUnwrap(reason, wrap);
                        resolve({status: "FAILED", log: wrap.log});
                    });
                } else {
                    resolve({status: <ResultStatus>ret, log: wrap.log});
                    wrap.unwrap();
                }
            } catch (error) {
                ActionService.logErroAndUnwrap(error, wrap);
                resolve({status: "FAILED", log: wrap.log});
            }
        });
    }

    static hasher = (val: string): string => {
        let sha256 = createHash("sha256");
        return sha256.update(val).digest("hex").toString();
    }
}

function redir(req: any, res: any): void {
    res.redirect("/info");
}

let httpServer: http.Server, httpsServer: https.Server;

/**
 * If port is -1, it resets it (undefined)
 * @param {number} port
 * @returns {number}
 */
function handleDynamicPortCase(port: number | undefined): number | undefined {
    if (port === -1)
        return undefined;
    return port;
}

export function startService(actionSecret: string, publishAction: PublishAction,
                             httpPort?: number | undefined,
                             httpsPort?: number | undefined): Promise<number[]> {
    ActionService.publishAction = publishAction;
    ActionService.secret = actionSecret;
    let host = os.hostname();
    let app: express.Application = express();
    app.use("/info", express.static(path.join(process.cwd(), "html")));
    app.get("/", redir);
    app.get("/action", redir);
    Server.buildServices(app, ActionService);

    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
        console.log("Handling error", err.message);
        if (err.status === "FAILED" && err.log && err.log.length) {
            res.set("Content-Type", "application/json");
            res.status(200);
            res.json(err);
        } else {
            console.error("Error:", err);
            next(err);
        }
    });

    let servers: Promise<number>[] = [];
    if (httpPort) {
        httpPort = handleDynamicPortCase(httpPort);
        servers.push(new Promise((resolve, reject) => {
            try {
                httpServer = http.createServer(app);
                httpServer.listen(httpPort, () => {
                    let address = httpServer.address();
                    if (!(typeof address === "string"))
                        httpPort = address.port;
                    console.log(`Rest Server listening on port http://${host}:${httpPort}/action!`);
                    resolve(httpPort);
                });
            } catch (err) {
                console.error("Cannot start HTTP server:" + err);
                reject(err);
            }
        }));
    }

    if (httpsPort) {
        httpsPort = handleDynamicPortCase(httpsPort);
        servers.push(new Promise((resolve, reject) => {
            try {
                let privateKey = fs.readFileSync("conf/key.pem", "utf8");
                let certificate = fs.readFileSync("conf/cert.pem", "utf8");
                let credentials = {key: privateKey, cert: certificate, passphrase: "1234"};

                httpsServer = https.createServer(credentials, app);
                httpsServer.listen(httpsPort, () => {
                    let address = httpsServer.address();
                    if (!(typeof address === "string"))
                        httpsPort = address.port;
                    console.log(`Rest Server listening on port https://${host}:${httpsPort}/action!`);
                    resolve(httpsPort);
                });
            } catch (err) {
                console.error("Cannot start HTTPS server:" + err);
                reject(err);
            }
        }));
    }
    return new Promise<number[]>((resolve, reject) => {
        Promise.all(servers)
            .then((values) => {
                resolve(values)
            })
            .catch((error) => {
                reject(error)
            });
    });
}

export function stopService(): Promise<("HTTP" | "HTTPS")[]> {
    let callback = (tansport: string,resolve:any) => {
        console.log(tansport + " Server Stopped");
        resolve();
    };

    let servers: Promise<"HTTP"|"HTTPS">[] = [];
    if (httpServer)
        servers.push(new Promise(((resolve) => {
            httpServer.close(() => callback("HTTP",resolve));
        })));

    if (httpsServer)
        servers.push(new Promise(((resolve) => {
            httpsServer.close(() => callback("HTTPS",resolve));
        })));

    return new Promise<("HTTP"|"HTTPS")[]>((resolve, reject) => {
        Promise.all(servers)
            .then((values) => {
                resolve(values)
            })
            .catch((error) => {
                reject(error)
            });
    });
}

