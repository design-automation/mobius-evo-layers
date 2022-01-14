require("module-alias/register");
import AWS from "aws-sdk";
import fetch from "node-fetch";
import JSZip from "jszip";
import { XMLHttpRequest } from "xmlhttprequest";
// import * as fs from "fs";
// import * as circularJSON from "circular-json";


import * as Modules from "@assets/core/modules";
import { _parameterTypes, _varString } from "@assets/core/modules";
import { GIModel } from "@libs/geo-info/GIModel";

// import { CodeUtils } from "./model/code/code.utils";
// import { IFlowchart, FlowchartUtils } from "./model/flowchart";
// import { IProcedure, ProcedureTypes } from "./model/procedure";
// import { INode } from "./model/node";
// import { checkArgInput } from "./utils/parser";

export const pythonListFunc = `
function pythonList(x, l){
    if (x < 0) {
        return x + l;
    }
    return x;
}
`;
// export const mergeInputsFunc = ` function mergeInputs(models){     let result
// = __modules__.${_parameterTypes.new}();     try {         result.debug =
// __debug__;     } catch (ex) {}     for (let model of models){
// __modules__.${_parameterTypes.merge}(result, model);     }     return result;
// }
export const mergeInputsFunc = `
function mergeInputs(models){
    let result = null;
    if (models.length === 0) {
        result = __modules__.${_parameterTypes.new}();
    } else if (models.length === 1) {
        result = models[0].clone();
    } else {
        result = models[0].clone();
        for (let i = 1; i < models.length; i++) {
            __modules__.${_parameterTypes.merge}(result, models[i]);
        }
    }
    try {
        result.debug = __debug__;
    } catch (ex) {}
    return result;
}
function duplicateModel(model){
    const result = model.clone();
    try {
        result.debug = __debug__;
    } catch (ex) {}
    return result;
}
`;
const printFuncString = `
function printFunc(_console, name, value){
    let val;
    if (!value) {
        val = value;
    } else if (typeof value === 'number' || value === undefined) {
        val = value;
    } else if (typeof value === 'string') {
        val = '"' + value + '"';
    } else if (value.constructor === [].constructor) {
        val = JSON.stringify(value);
    } else if (value.constructor === {}.constructor) {
        val = JSON.stringify(value);
    } else {
        val = value;
    }
    _console.push('_ ' + name + ': ' + val );
    return val;
}
`;

/**
 * GLOBAL CONSTANTS
 */

const GAUSSIAN_CONSTANT = 0.05;
const GAUSSIAN_STEP_ADJUSTMENT = 0.4;
const GAUSSIAN_CONSTANT_INCREMENT = 0.01;

const MUTATE_FAILURE_THRESHOLD = 20;
const TOURNAMENT_FAILURE_THRESHOLD = 20;

/**
 * AWS HANDLERS
 */

const DYNAMO_HANDLER = new AWS.DynamoDB.DocumentClient({ region: "us-east-1" });
const S3_HANDLER = new AWS.S3();
const LAMBDA_HANDLER = new AWS.Lambda({
    region: "us-east-1",
    httpOptions: {
        timeout: 600000,
        xhrAsync: true,
    },
});

function getModelString(model: GIModel): string {
    let model_data = model.exportGI(null);
    model_data = model_data.replace(/\\/g, "\\\\\\"); // TODO temporary fix
    return model_data;
}
export async function runJavascriptFile(event: { file: string; parameters: {}; model: string }) {
    const p = new Promise((resolve) => {
        fetch(event.file)
            .then((res) => {
                if (!res.ok) {
                    resolve("HTTP Request Error: request file timeout from url " + event.file);
                    return "";
                }
                return res.text();
            })
            .then(async (body) => {
                const splittedString = body.split("/** * **/");
                const argStrings = splittedString[0].split("// Parameter:");
                const args = [];
                if (argStrings.length > 1) {
                    for (let i = 1; i < argStrings.length - 1; i++) {
                        args.push(JSON.parse(argStrings[i]));
                    }
                    args.push(JSON.parse(argStrings[argStrings.length - 1].split("function")[0].split("async")[0]));
                }
                const val0 = args.map((arg) => arg.name);
                const val1 = args.map((arg) => {
                    if (event.parameters && event.parameters.hasOwnProperty(arg.name)) {
                        const numVal = Number(event.parameters[arg.name])
                        if (!numVal && numVal !== 0) {
                            return event.parameters[arg.name]
                        }
                        return numVal;
                    }
                    const numVal = Number(arg.value)
                    if (!numVal && numVal !== 0) {
                        return arg.value
                    }
                    return numVal;
                });
                let prefixString = `async function __main_func(__modules__, ` + val0 + `) {\n__debug__ = false;\n__model__ = null;\n`;
                if (event.model) {
                    prefixString = `async function __main_func(__modules__, ` + val0 + `) {\n__debug__ = false;\n__model__ = ` + event.model + `;\n`;
                }
                const postfixString = `\n}\nreturn __main_func;`;
                const fn = new Function(prefixString + splittedString[1] + postfixString);
                const result = await fn()(Modules, ...val1);
                result.model = getModelString(result.model);
                console.log(result.model);
                resolve("successful");
            });
    }).catch((err) => {
        throw err;
    });
    return await p;
}

export async function runJavascriptFileTest(event: { file: string; parameters: [] }) {
    fetch(event.file)
        .then((res) => {
            if (!res.ok) {
                return "";
            }
            return res.text();
        })
        .then(async (dataFile) => {
            const fn = new Function(dataFile.replace(/\\/g, ""));
            const result = await fn()(Modules);
            console.log(result.result);
        });
}
async function testExecuteJSFile(file, model = null, params = null) {
    const splittedString = file.split("/** * **/");
    const argStrings = splittedString[0].split("// Parameter:");
    const args = [];
    if (argStrings.length > 1) {
        for (let i = 1; i < argStrings.length - 1; i++) {
            args.push(JSON.parse(argStrings[i]));
        }
        args.push(JSON.parse(argStrings[argStrings.length - 1].split("function")[0].split("async")[0]));
    }
    const val0 = args.map((arg) => arg.name);
    const val1 = args.map((arg) => {
        if (params && params.hasOwnProperty(arg.name)) {
            return params[arg.name];
        }
        const numVal = Number(arg.value)
        if (!numVal && numVal !== 0) {
            return arg.value
        }
        return numVal;
    });
    let prefixString = `async function __main_func(__modules__, ` + val0 + `) {\n__debug__ = false;\n__model__ = null;\n`;
    if (model) {
        prefixString = `async function __main_func(__modules__, ` + val0 + `) {\n__debug__ = false;\n__model__ = \`${model}\`;\n`;
    }
    const postfixString = `\n}\nreturn __main_func;`;
    const fn = new Function(prefixString + splittedString[1] + postfixString);
    const result = await fn()(Modules, ...val1);
    return result;
}
export async function testGenEval(event: { genFile: string; evalFile: string; genParams: any }) {
    const promiseList = [];
    let genFile;
    let evalFile;
    promiseList.push(
        new Promise((resolve) => {
            fetch(event.genFile)
                .then((res) => {
                    if (!res.ok) {
                        resolve("HTTP Request Error: request file timeout from url " + event.genFile);
                        return "";
                    }
                    return res.text();
                })
                .then(async (body) => {
                    genFile = body;
                    resolve(null);
                });
        }).catch((err) => {
            throw err;
        })
    );
    promiseList.push(
        new Promise((resolve) => {
            fetch(event.evalFile)
                .then((res) => {
                    if (!res.ok) {
                        resolve("HTTP Request Error: request file timeout from url " + event.evalFile);
                        return "";
                    }
                    return res.text();
                })
                .then(async (body) => {
                    evalFile = body;
                    resolve(null);
                });
        }).catch((err) => {
            throw err;
        })
    );
    await Promise.all(promiseList);
    const genResult = await testExecuteJSFile(genFile, null, event.genParams);
    const genModel = getModelString(genResult.model);

    const evalResult = await testExecuteJSFile(evalFile, genModel, null);
    console.log(evalResult.result);
    return "successful";
}

export async function runGen(data): Promise<{__success__: boolean, __error__?: string}> {
    if (!data.genUrl || !data.evalUrl) {
        return { __success__: false, __error__: 'Gen Error: gen file or eval file URLs are not provided.' };
    }
    const p = new Promise<{__success__: boolean, __error__?: string}>(async (resolve) => {
        try {
            console.log("genURL:", data.genUrl);
            const genFile = await getGenEvalFile(data.genUrl);
            if (!genFile) {
                resolve({ __success__: false, __error__: 'Gen Error: Unable to place Gen Model onto S3.' });
            }

            const splittedString = genFile.split("/** * **/");
            const argStrings = splittedString[0].split("// Parameter:");
            const args = [];
            if (argStrings.length > 1) {
                for (let i = 1; i < argStrings.length - 1; i++) {
                    args.push(JSON.parse(argStrings[i]));
                }
                args.push(JSON.parse(argStrings[argStrings.length - 1].split("function")[0].split("async")[0]));
            }
            const val0 = args.map((arg) => arg.name);
            const val1 = args.map((arg) => {
                if (data.params && data.params.hasOwnProperty(arg.name)) {
                    const numVal = Number(data.params[arg.name]);
                    if (!numVal && numVal !== 0) {
                        return data.params[arg.name];
                    }
                    return numVal;
                }
                const numVal = Number(arg.value)
                if (!numVal && numVal !== 0) {
                    return arg.value
                }
                return numVal;
            });
            // const addedString = `__debug__ = false;\n__model__ = null;\n` const fn = new
            // Function('__modules__', ...val0, addedString + splittedString[1]); const
            // result = fn(Modules, ...val1); const model =
            // JSON.stringify(result.model.getData()).replace(/\\/g, '\\\\');

            const prefixString = `async function __main_func(__modules__, ` + val0 + `) {\n__debug__ = false;\n__model__ = null;\n`;
            const postfixString = `\n}\nreturn __main_func;`;
            const fn = new Function(prefixString + splittedString[1] + postfixString);
            const result = await fn()(Modules, ...val1);
            const model = getModelString(result.model).replace(/\\/g, "");

            let checkModelDB = false;
            let checkParamDB = false;

            S3_HANDLER.putObject(
                {
                    Bucket: process.env.STORAGE_MOBIUSEVOUSERFILES_BUCKETNAME,
                    Key: "public/" + data.owner + "/" + data.JobID + "/" + data.id + ".gi",
                    Body: model,
                    ContentType: "text/plain",
                    // ACL: "public-read",
                },
                function (err, result) {
                    if (err) {
                        console.log("Error placing gen model:", err);
                        resolve({ __success__: false, __error__: 'Gen Error: Unable to place Gen Model onto S3.' });
                    } else {
                        console.log("successfully placed model");
                        checkModelDB = true;
                        if (checkParamDB) {
                            resolve({__success__: true});
                        }
                    }
                }
            );
            const params = {
                TableName: process.env.API_MOBIUSEVOGRAPHQL_GENEVALPARAMTABLE_NAME,
                Item: {
                    id: data.id,
                    JobID: data.JobID,
                    GenID: data.GenID,
                    generation: data.generation,
                    genUrl: data.genUrl,
                    evalUrl: data.evalUrl,
                    params: JSON.stringify(data.params),
                    owner: data.owner,
                    live: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    errorMessage: null
                },
            };
            DYNAMO_HANDLER.put(params, function (err, result) {
                if (err) {
                    console.log("Error placing gen data:", err);
                    resolve({ __success__: false, __error__: 'Gen Error: Unable to place Gen Data onto DynamoDB.' });
                } else {
                    console.log("successfully placed data");
                    checkParamDB = true;
                    if (checkModelDB) {
                        console.log("ending function (data side)...");
                        resolve({__success__: true});
                    }
                }
            });
        } catch (ex) {
            resolve({ __success__: false, __error__: 'Gen Error: ' + ex.message });
        }
    });
    return await p;
}

export async function runEval(recordInfo): Promise<{__error__?: string}> {
    console.log("param id:", recordInfo.id);
    const params = {
        Bucket: process.env.STORAGE_MOBIUSEVOUSERFILES_BUCKETNAME,
        // Key: "models/" + recordInfo.id + ".gi",
        Key: "public/" + recordInfo.owner + "/" + recordInfo.JobID + "/" + recordInfo.id + ".gi",
    };
    const r = await S3_HANDLER.getObject(params).promise();
    if (!r) {
        return { __error__: 'Eval Error: Unable to retrieve Gen model.' };
    }
    const data = r.Body.toString("utf-8");
    if (!data || data === null) {
        return { __error__: 'Eval Error: Unable to retrieve Gen model.' };
    }
    if (!recordInfo.evalUrl) {
        return { __error__: 'Eval Error: No eval file url provided.' };
    }
    const p = new Promise(async (resolve) => {
        try {
            console.log("evalUrl:", recordInfo.evalUrl);
            const evalFile = await getGenEvalFile(recordInfo.evalUrl);
            if (!evalFile) {
                resolve({ __error__: 'Eval Error: Unable to retrieve eval file from url - ' + recordInfo.evalUrl });
            }
            const splittedString = evalFile.split("/** * **/");
            const argStrings = splittedString[0].split("// Parameter:");
            const args = [];
            if (argStrings.length > 1) {
                for (let i = 1; i < argStrings.length - 1; i++) {
                    args.push(JSON.parse(argStrings[i]));
                }
                args.push(JSON.parse(argStrings[argStrings.length - 1].split("function")[0].split("async")[0]));
            }
            const val0 = args.map((arg) => arg.name);
            const val1 = args.map((arg) => arg.value);

            const prefixString = `async function __main_func(__modules__, ` + val0 + ") {\n__debug__ = false;\n__model__ = `" + data + "`;\n";
            const postfixString = `\n}\nreturn __main_func;`;
            const fn = new Function(prefixString + splittedString[1] + postfixString);
            const result = await fn()(Modules, ...val1);
            const model = getModelString(result.model).replace(/\\/g, "");
            S3_HANDLER.putObject(
                {
                    Bucket: process.env.STORAGE_MOBIUSEVOUSERFILES_BUCKETNAME,
                    Key: "public/" + recordInfo.owner + "/" + recordInfo.JobID + "/" + recordInfo.id + "_eval.gi",
                    Body: model,
                    ContentType: "text/plain",
                    // ACL: "public-read",
                },
                function (err, data) {
                    if (err) {
                        console.log("Error placing eval model:", err);
                        resolve({ __error__: err.message });
                    } else {
                        console.log("successfully placed eval model");
                        resolve(result.result);
                    }
                }
            );
        } catch (ex) {
            console.log('error catched:', ex);
            resolve({ __error__: 'Eval Error: ' + ex.message });
        }
    });
    const result = await p;
    console.log("eval result:", result);
    return result;

}

function mutateDesign(existing_design, paramMap, existingParams, newIDNum, newGeneration, mutation_sd) {
    // const newID = existing_design.id.split('_'); newID[newID.length - 1] =
    // newIDNum
    const new_design = {
        id: existing_design.JobID + "_" + newIDNum,
        JobID: existing_design.JobID,
        GenID: newIDNum,
        generation: newGeneration,
        genUrl: existing_design.genUrl,
        evalUrl: existing_design.evalUrl,
        owner: existing_design.owner,
        params: null,
        score: null,
        live: true,
        scoreWritten: false,
        liveWritten: false,
        deadWritten: false,
    };
    let failCount = 0;
    while (true) {
        const new_param = {};
        for (const param of paramMap[new_design.genUrl]) {
            if (param.hasOwnProperty("step")) {
                let pos_neg = Math.floor(Math.random() * 2) == 0 ? -1 : 1;
                if (existing_design.params[param.name] === param.min) {
                    pos_neg = 1;
                } else if (existing_design.params[param.name] === param.max) {
                    pos_neg = -1;
                }

                let num_steps;
                if (pos_neg < 0) {
                    num_steps = (existing_design.params[param.name] - param.min) / param.step;
                } else {
                    num_steps = (param.max - existing_design.params[param.name]) / param.step;
                }

                const c = mutation_sd + GAUSSIAN_STEP_ADJUSTMENT / (num_steps + 1);
                const gaussian_mutation_val = Math.pow(Math.E, -1 * Math.pow(Math.random(), 2) / (2 * Math.pow(c, 2)));
                const added_val = pos_neg * Math.floor(gaussian_mutation_val * (num_steps + 1));

                const existing_step = (existing_design.params[param.name] - param.min) / param.step;
                new_param[param.name] = param.min + (existing_step + added_val) * param.step;
            } else {
                new_param[param.name] = existing_design.params[param.name];
            }
        }
        new_design.params = new_param;
        if (existingParams[new_design.genUrl]) {
            let duplicateCheck = false;
            for (const existingParam of existingParams[new_design.genUrl]) {
                let isDuplicate = true;
                for (const param of paramMap[new_design.genUrl]) {
                    if (new_param[param.name] !== existingParam[param.name]){
                        isDuplicate = false;
                        break;
                    }
                }
                if (isDuplicate) {
                    duplicateCheck = true;
                    break;
                }
            }
            if (duplicateCheck) {
                console.log('duplicate param:', new_param)
                if (failCount >= MUTATE_FAILURE_THRESHOLD) {
                    existingParams[new_design.genUrl].push(new_param);
                    break;
                }
                // c = c + ((1 - c) * GAUSSIAN_CONSTANT_INCREMENT);
                failCount += 1;
                continue;
            } else {
                existingParams[new_design.genUrl].push(new_param);
                break;
            }
        } else {
            existingParams[new_design.genUrl] = []
            existingParams[new_design.genUrl].push(new_param);
            break;
        }
        break;
    }
    return new_design;
}

function checkDuplicateDesign(newDesign, allParams): boolean {
    for (const existingParam of allParams) {
        if (newDesign.genUrl === existingParam.genUrl && newDesign.params === existingParam.params) {
            return true;
        }
    }
    return false;
}

// function getRandomDesign(designList, tournamentSize, eliminateSize) { }

function tournamentSelect(liveDesignList: any[], deadDesignList: any[], population_size: number, settings_tournament_size: number) {
    const liveDesignTournament = [];
    let tournament_size = settings_tournament_size;
    if (tournament_size >= liveDesignList.length) {
        tournament_size = liveDesignList.length - 1;
    }
    
    for (let i = 0; i < liveDesignList.length; i++) {
        liveDesignTournament.push({
            GenID: liveDesignList[i].GenID,
            score: liveDesignList[i].score,
            rank: 0,
            count: 0,
            indices: {},
        });
    }
    
    for (let i = 0; i < liveDesignList.length; i++) {
        let failCount = 0;
        while (liveDesignTournament[i].count < tournament_size) {
            const randomIndex = Math.floor(Math.random() * liveDesignList.length);
            if (randomIndex === i || liveDesignTournament[i].indices[randomIndex]) {
                continue;
            }
            if (failCount < TOURNAMENT_FAILURE_THRESHOLD && liveDesignTournament[randomIndex].count >= tournament_size) {
                failCount += 1;
                continue;
            }
            failCount = 0;
            if (liveDesignTournament[i].score > liveDesignTournament[randomIndex].score) {
                liveDesignTournament[i].rank += 1;
            }
            liveDesignTournament[i].count += 1;
            liveDesignTournament[i].indices[randomIndex] = true;
            if (liveDesignTournament[randomIndex].count < tournament_size) {
                liveDesignTournament[randomIndex].count += 1;
                liveDesignTournament[randomIndex].indices[i] = true;
                if (liveDesignTournament[randomIndex].score > liveDesignTournament[i].score) {
                    liveDesignTournament[randomIndex].rank += 1;
                }
            }
        }
    }
    
    const sortedTournament = liveDesignTournament.sort((a, b) => {
        if (a.rank === b.rank) {
            return a.score - b.score;
        }
        return a.rank - b.rank;
    });
    
    const numDiscards = liveDesignList.length - population_size;
    for (let i = 0; i < numDiscards; i++) {
        for (let j = 0; j < liveDesignList.length; j++) {
            if (sortedTournament[i].GenID === liveDesignList[j].GenID) {
                liveDesignList[j].live = false;
                deadDesignList.push(liveDesignList[j]);
                liveDesignList.splice(j,1);
                break;
            }
        }
    }
}

// // ________________________ OLD TOURNAMENT CODE ________________________
// function tournamentSelect(liveDesignList: any[], deadDesignList: any[], tournament_size: number, survival_size: number) {
//     // select tournamentSize number of designs from live list
//     let selectedDesigns = [];
//     for (let i = 0; i < tournament_size; i++) {
//         if (liveDesignList.length === 0) {
//             break;
//         }
//         const randomIndex = Math.floor(Math.random() * liveDesignList.length);
//         selectedDesigns.push(liveDesignList.splice(randomIndex, 1)[0]);
//     }
//     // sort the selectedDesigns list in ascending order according to each design's
//     // score
//     selectedDesigns = selectedDesigns.sort((a, b) => a.score - b.score);
//     // mark the first <eliminateSize> entries as dead and add them to the
//     // deadDesignList, add the rest back to the liveDesignList
//     for (let j = 0; j < selectedDesigns.length; j++) {
//         if (j < survival_size) {
//             selectedDesigns[j].live = false;
//             deadDesignList.push(selectedDesigns[j]);
//         } else {
//             liveDesignList.push(selectedDesigns[j]);
//         }
//     }
// }

async function getGenEvalFile(fileUrl): Promise<any> {
    const filePromise = new Promise((resolve) => {
        if (fileUrl.indexOf("s3.amazonaws") !== -1) {
            const urlSplit = decodeURIComponent(fileUrl).split(".s3.amazonaws.com/");
            const item = {
                Bucket: urlSplit[0].replace("https://", ""),
                Key: urlSplit[1],
            };
            S3_HANDLER.getObject(item, function (err, data) {
                if (err) {
                    console.log(err, err.stack);
                    resolve(null);
                } else {
                    resolve(data.Body.toString("utf-8"));
                }
            });
        } else {
            const request = new XMLHttpRequest();
            request.open("GET", fileUrl);
            request.onload = async () => {
                if (request.status === 200) {
                    resolve(request.responseText);
                } else {
                    resolve(null);
                }
            };
            request.send();
        }
    }).catch((err) => {
        throw err;
    });
    return filePromise;
}

async function updateJobDB(jobID: string, run: boolean, status: string, history: any[]) {
    const jobDBUpdatePromise = new Promise<boolean>((resolve) => {
        const runStart = history[history.length - 1].runStart
        const runEnd = new Date();
        if (history.length > 0) {
            //@ts-ignore
            history[history.length - 1].runTime = (runEnd - runStart) / 1000;
            history[history.length - 1].runEnd = runEnd;
            history[history.length - 1].status = status;
        }
        DYNAMO_HANDLER.update(
            {
                TableName: process.env.API_MOBIUSEVOGRAPHQL_JOBTABLE_NAME,
                Key: {
                    id: jobID,
                },
                UpdateExpression: "set endedAt=:t, run=:r, jobStatus=:s, updatedAt=:u, history=:h",
                ExpressionAttributeValues: {
                    ":t": new Date().toISOString(),
                    ":r": run,
                    ":s": status,
                    ":u": new Date().toISOString(),
                    ":h": JSON.stringify(history)
                },
                ReturnValues: "UPDATED_NEW",
            },
            (err, record) => {
                if (err) {
                    console.log("error updating job db", err);
                    resolve(false);
                } else {
                    console.log("successfully updating job db");
                    resolve(true);
                }
            }
        );
    }).catch((err) => {
        console.log("job db update error", err);
        throw err;
    });
    await jobDBUpdatePromise;
}


async function getJobEntries(jobID, allEntries, liveEntries, existingParams) {
    const p = new Promise((resolve) => {
        DYNAMO_HANDLER.query(
            {
                TableName: process.env.API_MOBIUSEVOGRAPHQL_GENEVALPARAMTABLE_NAME,
                IndexName: "byJobID",
                KeyConditionExpression: "JobID = :job ",
                ExpressionAttributeValues: {
                    ":job": jobID,
                },
            },
            function (err, response) {
                if (err) {
                    console.log("Error retrieving parent data:", err);
                    resolve(null);
                } else {
                    resolve(response.Items);
                }
            }
        );
    }).catch((err) => {
        throw err;
    });
    let prevItems: any = await p;
    if (!prevItems) {
        return;
    }
    prevItems.forEach((item: any) => {
        if (typeof item.params === "string") {
            item.params = JSON.parse(item.params);
        }
        allEntries.push(item);
        if (!existingParams[item.genUrl]) {
            existingParams[item.genUrl] = []
        }
        existingParams[item.genUrl].push(item.params);
    });
    prevItems = prevItems.filter((item: any) => item.live === true);
    prevItems = prevItems.sort((a: any, b: any) => {
        if (a.live !== b.live) {
            return b.live - a.live;
        }
        return b.score - a.score;
    });
    for (let i = 0; i < prevItems.length; i++) {
        prevItems[i].scoreWritten = false;
        prevItems[i].liveWritten = false;
        prevItems[i].deadWritten = false;
        if (!prevItems[i].generation) {
            prevItems[i].generation = 1;
        }
        liveEntries.push(prevItems[i]);
    }
}

async function removeJobData(record) {
    const getItemsPromises = [];
    const deleteObjectPromises = [];
    const event = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.OldImage);
    console.log("Unmarshalled Record to be removed:", event);

    const paramsQuery: any = {
        TableName: process.env.API_MOBIUSEVOGRAPHQL_GENEVALPARAMTABLE_NAME,
        IndexName: "byJobID",
        KeyConditionExpression: "JobID = :job ",
        ExpressionAttributeValues: {
            ":job": event.id,
        },
    };

    async function queryParams() {
        const p = new Promise( resolve => {
            DYNAMO_HANDLER.query(paramsQuery, onQuery);
            async function onQuery(err, data) {
                if (err) {
                    console.error("Unable to scan the table. Error JSON:", JSON.stringify(err, null, 2));
                } else {
                    // print all the movies
                    console.log("Query succeeded.");
                    console.log("  ", data.Count);
                    data.Items.forEach(function(param) {
                        deleteObjectPromises.push(DYNAMO_HANDLER.delete(
                            {
                                TableName: process.env.API_MOBIUSEVOGRAPHQL_GENEVALPARAMTABLE_NAME,
                                Key: {
                                    id: param.id
                                }
                            }
                        ).promise())
                    });
                    // continue scanning if we have more movies, because
                    // scan can retrieve a maximum of 1MB of data
                    if (typeof data.LastEvaluatedKey != "undefined") {
                        console.log("Scanning for more...");
                        paramsQuery.ExclusiveStartKey = data.LastEvaluatedKey;
                        await queryParams();
                    }
                }
                resolve(null);
            }
        })
        return p;
    }
    getItemsPromises.push(queryParams());


    const s3Query: any = {
        Bucket: process.env.STORAGE_MOBIUSEVOUSERFILES_BUCKETNAME,
        Prefix: `public/${event.owner}/${event.id}`,
    };
    const allKeys = [];

    async function listAllKeys() {
        const p = new Promise( resolve =>
            S3_HANDLER.listObjectsV2(s3Query, async function (err, data) {
                if (err) {
                    console.log(err, err.stack); // an error occurred
                } else {
                    const contents = data.Contents;
                    if (contents.length > 0) {
                        const keyList = []
                        contents.forEach(function (content) {
                            allKeys.push(content.Key)
                            keyList.push({
                                Key: content.Key
                            });
                        });
                        deleteObjectPromises.push(S3_HANDLER.deleteObjects({
                            Bucket: s3Query.Bucket, 
                            Delete: {
                                Objects: keyList, 
                                Quiet: false
                            }
                        }).promise())
                    }
                    if (data.IsTruncated) {
                        s3Query.ContinuationToken = data.NextContinuationToken;
                        console.log("get further list...");
                        await listAllKeys();
                    }
                }
                resolve(null);
            })
        )
        return p;
    }
    getItemsPromises.push(listAllKeys());
    await Promise.all(getItemsPromises);
    await Promise.all(deleteObjectPromises);
    console.log('allKeys count:', allKeys.length)
}

export async function runGenEvalController(input) {
    console.log("~~~ input: ", input);
    const record = input.Records[0];
    if (record.eventName !== "INSERT" && record.eventName !== "MODIFY") {
        if (record.eventName === "REMOVE") {
            await removeJobData(record)
        }
        return;
    }
    console.log("DynamoDB Record: %j", record.dynamodb);
    const event = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);
    console.log("Unmarshalled Record:", event);
    if (!event.genUrl || !event.evalUrl || !event.run) {
        return false;
    }
    if (typeof event.genUrl === "string") {
        return false;
    }

    console.log("Run Settings:", event.run_settings)
    let population_size, max_designs, tournament_size, mutation_sd, history;

    if (event.run_settings) {
        const run_settings = JSON.parse(event.run_settings);
        population_size = run_settings.population_size;
        max_designs = run_settings.max_designs;
        tournament_size = run_settings.tournament_size;
        mutation_sd = run_settings.mutation_sd;
        history = [{
            runStart: new Date(),
            runEnd: null,
            runTime: null,
            genUrl: event.genUrl,
            evalUrl: event.evalUrl,
            run_settings: run_settings
        }];
    } else {
        population_size = event.population_size;
        max_designs = event.max_designs;
        tournament_size = event.tournament_size;
        mutation_sd = event.mutation_sd? event.mutation_sd: 0.05;
        history = [{
            runStart: new Date(),
            runEnd: null,
            runTime: null,
            genUrl: event.genUrl,
            evalUrl: event.evalUrl,
            run_settings: {
                population_size: population_size,
                max_designs: max_designs,
                tournament_size: tournament_size,
                mutation_sd: mutation_sd,
            }
        }];
    }
    console.log("population_size:", population_size)
    console.log("max_designs:", max_designs)
    console.log("tournament_size:", tournament_size)
    console.log("mutation_sd:", mutation_sd)

    let updatedPastHistory = false;
    // const survival_size = event.survival_size;

    const paramMap = {};
    for (const genUrl of event.genUrl) {
        console.log(" __ genUrl:", genUrl);
        const genFile = await getGenEvalFile(genUrl);
        if (!genFile) {
            console.log("Error: Unable to Retrieve Gen File!");
            return false;
        }
        // const genFile = genResult[0];
        const splittedString = genFile.split("/** * **/");
        const argStrings = splittedString[0].split("// Parameter:");
        const params = [];
        if (argStrings.length > 1) {
            for (let i = 1; i < argStrings.length - 1; i++) {
                params.push(JSON.parse(argStrings[i]));
            }
            params.push(JSON.parse(argStrings[argStrings.length - 1].split("function")[0].split("async")[0]));
        }
        params.forEach((x) => {
            if (x.min && typeof x.min !== "number") {
                x.min = Number(x.min);
            }
            if (x.max && typeof x.max !== "number") {
                x.max = Number(x.max);
            }
            if (x.step && typeof x.step !== "number") {
                x.step = Number(x.step);
            }
        });
        if (!params) {
            continue;
        }
        paramMap[genUrl] = params;
    }
    let allEntries = [];
    const liveEntries = [];
    const deadEntries = [];
    const updateDynamoPromises = [];
    const existingParams = {};

    await getJobEntries(event.id, allEntries, liveEntries, existingParams);
    let newGeneration = 0;
    liveEntries.forEach((entry) => (newGeneration = Math.max(entry.generation, newGeneration)));
    newGeneration++;
    // run simulation
    let designCount = 0;
    let hasError = false;

    let initializeCheck = true;
    while (designCount < max_designs) {
        if (designCount === 0) {
            designCount = allEntries.length;
        }
        // check if the job should still be running:  _ check JOB_DB for the job, if
        // job.run is not true, stop the run and return
        const getJobPromise = new Promise((resolve) => {
            DYNAMO_HANDLER.get(
                {
                    TableName: process.env.API_MOBIUSEVOGRAPHQL_JOBTABLE_NAME,
                    Key: {
                        id: event.id,
                    },
                },
                (err, record) => {
                    if (err) {
                        console.log(err);
                        resolve(null);
                    } else {
                        console.log("... run check for", event.id, "; items:", record);
                        resolve(record.Item);
                    }
                }
            );
        }).catch((err) => {
            throw err;
        });
        const jobItem: any = await getJobPromise;
        const runCheck = jobItem.run;
        if (!updatedPastHistory) {
            try {
                if (jobItem.history) {
                    const pastHistory = JSON.parse(jobItem.history);
                    pastHistory.forEach(historyItem => history.splice(history.length - 1, 0, historyItem))
                }
                updatedPastHistory = true;
            } catch(ex) {}
        }
        if (!runCheck) {
            await Promise.all(updateDynamoPromises);
            await updateJobDB(event.id, false, "cancelled", history);
            console.log("run cancelled !!!");
            return false;
        }

        // // mutate designs until reaching max number of designs or twice the population
        // const mutationNumber =
        //     population_size * 2 - liveEntries.length < max_designs - designCount ? population_size * 2 - liveEntries.length : max_designs - designCount;

        if (!initializeCheck) {
            // mutate designs until reaching max number of designs or twice the population
            let mutationNumber = (liveEntries.length < (max_designs - designCount))? liveEntries.length: (max_designs - designCount);
            console.log("number of mutations:", mutationNumber);
            for (let i = 0; i < mutationNumber; i++) {
                const newDesign = mutateDesign(liveEntries[i], paramMap, existingParams, allEntries.length, newGeneration, mutation_sd);
                console.log("new design:", newDesign);
                allEntries.push(newDesign);
                liveEntries.push(newDesign);
            }
            newGeneration++;
        }
        initializeCheck = false;
        designCount = allEntries.length;

        // for each of the live entries, run gen then run eval sequentially. each entry
        // is added to a promiselist
        const promiseList = [];
        for (const entry of liveEntries) {
            if (entry.score) {
                continue;
            }
            promiseList.push(
                new Promise((resolve) => {
                    const entryBlob = JSON.stringify(entry);
                    // run gen
                    LAMBDA_HANDLER.invoke(
                        {
                            FunctionName: process.env.FUNCTION_EVOGENERATE_NAME,
                            Payload: entryBlob,
                        },
                        (err, genResponse) => {
                            if (err || !genResponse) {
                                console.log("Gen File error:", entry.params, '\n', err);
                                resolve({
                                    success: false,
                                    id: entry.id,
                                    error: "Gen Error: " + err.message
                                });
                            }
                            const genResult = JSON.parse(genResponse.Payload.toString());
                            if (genResult.__error__) {
                                console.log("Gen File error:", entry.params, '\n', err);
                                resolve({
                                    success: false,
                                    id: entry.id,
                                    error: genResult.__error__
                                });
                            }
                            // run eval
                            LAMBDA_HANDLER.invoke(
                                {
                                    FunctionName: process.env.FUNCTION_EVOEVALUATE_NAME,
                                    Payload: entryBlob,
                                },
                                (err, evalResponse) => {
                                    if (err || !evalResponse) {
                                        console.log("Eval Error:", entry.params, '\n', err);
                                        resolve({
                                            success: false,
                                            id: entry.id,
                                            error: "Eval Error: " + err.message
                                        });
                                    }
                                    try {
                                        const evalResult = JSON.parse(evalResponse.Payload.toString());
                                        console.log("eval result:", evalResult);
                                        if (evalResult.__error__) {
                                            console.log("Eval Error:", entry.params, '\n', evalResult.__error__);
                                            resolve({
                                                success: false,
                                                id: entry.id,
                                                error: evalResult.__error__
                                            });
                                        }
                                        // const evalScore = new Number(response.Payload);
                                        entry.evalResult = JSON.stringify(evalResult);
                                        entry.score = evalResult.score;
                                        resolve({
                                            success: true,
                                            id: entry.id
                                        });
                                    } catch (ex) {
                                        console.log("failed parsing evalResult", entry.params);
                                        resolve({
                                            success: false,
                                            id: entry.id,
                                            error: "Eval Error: failed parsing evalResult"
                                        });
                                    }
                                    
                                }
                            );
                        }
                    );
                }).catch((err) => {
                    throw err;
                })
            );
        }

        // wait for all promises to be resolved
        await Promise.all(promiseList).then((results) => {
            console.log('execute results:', results)
            for (const r of results) {
                if (!r.success) {
                    for (let i = 0; i < liveEntries.length; i++) {
                        if (liveEntries[i].id === r.id) {
                            const entry = liveEntries.splice(i, 1)[0];
                            entry.live = false;
                            entry.score = 0;
                            entry.evalResult = `{"Error": "${r.error}"}`;
                            entry.liveWritten = true;
                            entry.deadWritten = true;
                            deadEntries.push(entry);
                            hasError = true;
                            const params = {
                                TableName: process.env.API_MOBIUSEVOGRAPHQL_GENEVALPARAMTABLE_NAME,
                                Item: {
                                    id: entry.id,
                                    JobID: entry.JobID,
                                    GenID: entry.GenID,
                                    generation: entry.generation,
                                    genUrl: entry.genUrl,
                                    evalUrl: entry.evalUrl,
                                    params: JSON.stringify(entry.params),
                                    owner: entry.owner,
                                    live: false,
                                    createdAt: new Date().toISOString(),
                                    updatedAt: new Date().toISOString(),
                                    score: 0,
                                    evalResult: `"${r.error}"`,
                                    errorMessage: r.error
                                },
                            };
                            updateDynamoPromises.push(new Promise(resolve => {
                                DYNAMO_HANDLER.put(params, (err, data) => {
                                    resolve(null);
                                })
                            }));
                            break;
                        }
                    }
                }
            }
        });

        tournamentSelect(liveEntries, deadEntries, population_size, tournament_size);

        // // select the entries based on score
        // while (liveEntries.length > population_size) {
        //     const elimSize = survival_size <= liveEntries.length - population_size ? survival_size : liveEntries.length - population_size;
        //     tournamentSelect(liveEntries, deadEntries, tournament_size, elimSize);
        // }

        // update each live entries
        for (const entry of liveEntries) {
            let updateParamEntry;
            if (!entry.scoreWritten) {
                entry.scoreWritten = true;
                updateParamEntry = {
                    TableName: process.env.API_MOBIUSEVOGRAPHQL_GENEVALPARAMTABLE_NAME,
                    Key: {
                        id: entry.id,
                    },
                    UpdateExpression: "set score=:sc, evalResult=:ev, updatedAt=:u, survivalGeneration=:sg",
                    ExpressionAttributeValues: {
                        ":sc": entry.score,
                        ":ev": entry.evalResult,
                        ":u": new Date().toISOString(),
                        ":sg": newGeneration - 1
                    },
                    ReturnValues: "UPDATED_NEW",
                };
            } else {
                updateParamEntry = {
                    TableName: process.env.API_MOBIUSEVOGRAPHQL_GENEVALPARAMTABLE_NAME,
                    Key: {
                        id: entry.id,
                    },
                    UpdateExpression: "set survivalGeneration=:sg",
                    ExpressionAttributeValues: {
                        ":sg": newGeneration - 1
                    },
                    ReturnValues: "UPDATED_NEW",
                };
            }
            const p = new Promise((resolve) => {
                DYNAMO_HANDLER.update(updateParamEntry, function (err, data) {
                    if (err) {
                        console.log("Error placing data (live entry's score, evalResult):", err);
                        resolve(null);
                    } else {
                        resolve(null);
                    }
                });
            }).catch((err) => {
                console.log("live entry writing error:", err);
                throw err;
            });
            updateDynamoPromises.push(p);
        }

        // update each dead entries
        for (const entry of deadEntries) {
            if (!entry.deadWritten) {
                entry.deadWritten = true;
                const updateParamEntry = {
                    TableName: process.env.API_MOBIUSEVOGRAPHQL_GENEVALPARAMTABLE_NAME,
                    Key: {
                        id: entry.id,
                    },
                    UpdateExpression: "set live = :l, score=:s, evalResult=:e, updatedAt=:u",
                    ExpressionAttributeValues: {
                        ":l": false,
                        ":s": entry.score,
                        ":e": entry.evalResult,
                        ":u": new Date().toISOString(),
                    },
                    ReturnValues: "UPDATED_NEW",
                };
                const p = new Promise((resolve) => {
                    DYNAMO_HANDLER.update(updateParamEntry, function (err, data) {
                        if (err) {
                            console.log("Error placing data (dead entry's score, evalResult):", err);
                            resolve(null);
                        } else {
                            resolve(null);
                        }
                    });
                }).catch((err) => {
                    console.log("dead entry writing error:", err);
                    throw err;
                });
                updateDynamoPromises.push(p);
            }
        }
        if (liveEntries.length === 0) {
            break;
        }
    }
    await Promise.all(updateDynamoPromises)
        .then(() => console.log("updateDynamoPromises finishes"))
        .catch((err) => console.log(err));
    if (hasError) {
        await updateJobDB(event.id, false, "cancelled", history);
    } else {
        await updateJobDB(event.id, false, "completed", history);
    }
    console.log("process complete");
    return true;
}
