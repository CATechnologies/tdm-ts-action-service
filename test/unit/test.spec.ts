// Copyright © 2018 CA. All rights reserved.  CA Confidential.  Please see License.txt file for applicable usage rights and restrictions.
import "mocha";
import {ResultStatus, start, stop, Request} from "../../src/ts-action-service";
import * as chai from 'chai';
import fetch from 'node-fetch';
import https = require("https");

const expect = chai.expect;
const secret123 = "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3";

function buildRequest(what: string): Request {
    return {
        jobId: 1,
        jobTitle: "title",
        secret: secret123,
        type: "pre",
        token: "token",
        tdmUrl: "TDM",
        connectionProfileName: "profile",
        outputType: "CSV",
        parameters: {what: what}

    };
}

function CustomPublishActionToTest(req: any): Promise<ResultStatus> | ResultStatus {
    console.log("Custom action invoked");
    expect(req.tdmUrl).to.eq("TDM");
    expect(req.jobId).to.eq(1);
    expect(req.jobTitle).to.eq("title");
    expect(req.outputType).to.eq("CSV");
    expect(req.type).to.eq("pre");
    expect(req.token).to.eq("token");
    expect(req.connectionProfileName).to.eq("profile");
    let what = req.parameters.what;
    console.log(what);
    switch (what) {
        case "sync-ok": {
            return "SUCCESS";
        }
        case "sync-fail": {
            return "FAILED";
        }
        case "sync-throw": {
            throw new Error("sync-throw");
        }
    }
    return new Promise<ResultStatus>((resolve, reject) => {
        setTimeout(() => {
            switch (what) {
                case "async-ok": {
                    resolve("SUCCESS");
                    return;
                }
                case "async-fail": {
                    reject("FAILED");
                    return;
                }
            }
        }, 500);
    });
}

function simpleRequestCheck(transport: any, port: any) {
    let httpsAgent = new https.Agent({
        rejectUnauthorized: false
    });
    let init: any = {
        method: 'post',
        body: JSON.stringify(buildRequest("sync-ok")),
        headers: {'content-type': 'application/json'}
    };
    if (transport === "https")
        init.agent = httpsAgent;
    return fetch(`${transport}://localhost:${port}/action`, init).then(res => res.json()).then(
        result => {
            console.log("Got result");
            console.log(result.log);
            expect(result.status).to.eq("SUCCESS");
            expect(result.log.length).to.gt(0);
            expect(result.log[0].stream).to.eq("out");
            expect(result.log[0].msg).to.contains("Custom action invoked");
        });
}

describe("Action Service Startup Tests", () => {
    describe("Action service start - various combinations", async () => {
        it(`should on HTTP and HTTPS depending on configuration and return ok`, async () => {
            for (let pHTTP of [-1, 8080, undefined]) {
                for (let pHTTPS of [-1, 8443, undefined]) {
                    if (!pHTTP && !pHTTPS)
                        continue;
                    console.log("Starting combination:  ", pHTTP, pHTTPS);
                    let ports = await start("123", CustomPublishActionToTest, pHTTP, pHTTPS);
                    try {
                        console.log("Started on ports:", ports.join(","));
                        let index = 0;
                        if (pHTTP)
                            await simpleRequestCheck("http", ports[index++]);
                        if (pHTTPS)
                            await simpleRequestCheck("https", ports[index++]);
                    } finally {
                        await stop();
                    }
                }
            }
        });
    });
});

describe("Req/resp Action Service Tests", () => {

    before(async () => {
        await start("123", CustomPublishActionToTest, 8080);
    });

    after(() => {
        stop();
    });

    describe("Action service test - sync", () => {
        it('should invoke custom function and return ok', (done) => {
            fetch('http://localhost:8080/action', {
                method: 'post',
                body: JSON.stringify(buildRequest("sync-ok")),
                headers: {'content-type': 'application/json'}
            }).then(res => res.json()).then(result => {
                console.log("Got result");
                console.log(result.log);
                expect(result.status).to.eq("SUCCESS");
                expect(result.log.length).to.gt(0);
                expect(result.log[0].stream).to.eq("out");
                expect(result.log[0].msg).to.contains("Custom action invoked");
                done();
            });
        });
        it('should invoke custom function and fail', (done) => {
            fetch('http://localhost:8080/action', {
                method: 'post',
                body: JSON.stringify(buildRequest("sync-fail")),
                headers: {'content-type': 'application/json'}
            }).then(res => res.json()).then(result => {
                console.log("Got result");
                console.log(result.log);
                expect(result.status).to.eq("FAILED");
                expect(result.log.length).to.gt(0);
                expect(result.log[0].stream).to.eq("out");
                expect(result.log[0].msg).to.contains("Custom action invoked");
                done();
            });
        });
        it('should invoke custom function and throw error', (done) => {
            fetch('http://localhost:8080/action', {
                method: 'post',
                body: JSON.stringify(buildRequest("sync-throw")),
                headers: {'content-type': 'application/json'}
            }).then(res => res.json()).then(result => {
                console.log("Got result");
                console.log(result.log);
                expect(result.status).to.eq("FAILED");
                expect(result.log.length).to.gt(0);
                expect(result.log[0].stream).to.eq("out");
                expect(result.log[0].msg).to.contains("Custom action invoked");
                expect(result.log[3].stream).to.eq("err");
                done();
            });
        });
    });

    describe("Action service test - async", () => {
        it('should invoke custom function and return ok', (done) => {
            fetch('http://localhost:8080/action', {
                method: 'post',
                body: JSON.stringify(buildRequest("async-ok")),
                headers: {'content-type': 'application/json'}
            }).then(res => res.json()).then(result => {
                console.log("Got result");
                console.log(result.log);
                expect(result.status).to.eq("SUCCESS");
                expect(result.log.length).to.gt(0);
                expect(result.log[0].stream).to.eq("out");
                expect(result.log[0].msg).to.contains("Custom action invoked");
                done();
            });
        });
        it('should invoke custom function and fail', (done) => {
            fetch('http://localhost:8080/action', {
                method: 'post',
                body: JSON.stringify(buildRequest("async-fail")),
                headers: {'content-type': 'application/json'}
            }).then(res => res.json()).then(result => {
                console.log("Got result");
                console.log(result.log);
                expect(result.status).to.eq("FAILED");
                expect(result.log.length).to.gt(0);
                expect(result.log[0].stream).to.eq("out");
                expect(result.log[0].msg).to.contains("Custom action invoked");
                done();
            });
        });
    });

});
