# Sample TypeScript Implementation of TDM Action Service 
This repository contains a sample TypeScript (Node.js) implementation of TDM Action Service. 

It is easy to plug in custom implementation of a custom action and register in Test Data Manager (TDM).

It is possible to use the action outside of the Docker container and run in on any platform which supports Node.js.

# Prerequisites

It is possible to build and run a sample service locally:

```console
$ npm install
$ npm test
```

**Note that it is necessary to provide a certificate in order to start HTTPS transport. Make sure that there are these files:**
 
   * `conf/key.pem` 
   * `conf/cert.pem`  

You can generate a sample self-signed certifacte with these commands:
```console
$ openssl req -x509 -newkey rsa:2048 -nodes -keyout keytmp.pem -out conf/cert.pem -days 3653 -subj "/C=/OU=/CN=/emailAddress=a@b"
$ openssl rsa -in keytmp.pem -out conf/key.pem
```

# Basic Usage

```typescript
import {start} from "ts-action-service";

let actionSecret = process.env.ACTION_SECRET ? process.env.ACTION_SECRET : "123";
start(actionSecret, (req) => {
    // custom logic which is trigger by TDM
    console.log("Custom action invoked");
    console.log("Called by "+req.tdmUrl);
    console.log("Custom variable "+req.parameters.customVariable);
    return "SUCCESS";
    },8080);
```

Custom actions which require asynchronous implementation can return Promise.

```typescript
import {start,ResultStatus} from "ts-action-service";

let actionSecret = process.env.ACTION_SECRET ? process.env.ACTION_SECRET : "123";
start(actionSecret, (req) => {
    // custom logic which is trigger by TDM
            return new Promise<ResultStatus>((resolve, reject) => {
                setTimeout(() => {
                    resolve("SUCCESS");
                }, 500);
            });
    },8080);
```

When you pass -1 for HTTP and HTTPS ports, they will be allocated dynamically. Port values are avaialble in the returned promise. 

```typescript
start(actionSecret, (req) => {
    return "SUCCESS";
    }-1,-1).then((ports)=>{
         console.log("Started");
         console.log(ports);
         // prints e.g. [ 60887, 60888 ]
     });
```
## To build the image locally
Use script [Docker.build.sh](Docker.build.sh).

## To run the image
Use script [Docker.run.sh](Docker.run.sh).
