// Copyright © 2018 CA. All rights reserved.  CA Confidential.  Please see License.txt file for applicable usage rights and restrictions.
import {startService, stopService} from "./utils";

/**
 * This info from TDM is pass as an input to publish actions.
 */
export interface Request {
    jobId: number;
    jobTitle: string;
    secret: string;
    type: string;
    token: string;
    tdmUrl: string;
    connectionProfileName: string;
    outputType: string;
    parameters: any;
}

export type ResultStatus = "SUCCESS" | "FAILED";
/**
 * Custom publish action callback
 *
 * @req        Info from TDM
 * @return     Status or promise for status when the action is asynchronous
 */
export type PublishAction = (req: Request) => ResultStatus | Promise<ResultStatus>;

/**
 * This function starts Action Service which can tbe then registered in TDM.
 *
 * @param {string} actionSecret    secret which is passed to this action and TDM to prevent misuse of the aciton by
 *                                  attackers
 * @param {PublishAction} publishAction   implementation of the custom logic
 * @param {number} httpPort               optionally, pass a number to listen on HTTP port (-1 means to find dynamic port)
 * @param {number} httpsPort              optionally, pass a number to listen start server on HTTPS port (-1 means to find dynamic port)
 * @return      promise which is resolved when all servers are started. The Promise resolves to the list of port numbers on which servers listen.
 */
export function start(actionSecret: string, publishAction: PublishAction,
                      httpPort?: number | undefined, httpsPort?: number | undefined): Promise<number[]> {
    return startService(actionSecret, publishAction, httpPort, httpsPort);
}

export function stop(): Promise<("HTTP" | "HTTPS")[]> {
    return stopService();
}

