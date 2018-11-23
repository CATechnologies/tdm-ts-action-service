// Copyright © 2018 CA. All rights reserved.  CA Confidential.  Please see License.txt file for applicable usage rights and restrictions.
import {start} from "./ts-action-service";

let actionSecret = process.env.ACTION_SECRET ? process.env.ACTION_SECRET : "123";
start(actionSecret, (req) => {
    // custom logic which is trigger by TDM
    console.log("Custom action invoked");
    console.log("Called by "+req.tdmUrl);
    console.log("Custom variable "+req.parameters.customVariable);
    return "SUCCESS";
},8080,8443).then((ports)=>{
    console.log("Started");
    console.log(ports);
});
