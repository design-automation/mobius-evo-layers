"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runGenEvalController = exports.runEval = exports.runGen = exports.testGenEval = exports.runJavascriptFileTest = exports.runJavascriptFile = void 0;
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const xmlhttprequest_1 = require("xmlhttprequest");
const mobius_sim_funcs_1 = import("@design-automation/mobius-sim-funcs");
const mobius_inline_funcs_1 = import("@design-automation/mobius-inline-funcs");
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
const DYNAMO_HANDLER = new aws_sdk_1.default.DynamoDB.DocumentClient({ region: "us-east-1" });
const S3_HANDLER = new aws_sdk_1.default.S3();
const LAMBDA_HANDLER = new aws_sdk_1.default.Lambda({
    region: "us-east-1",
    httpOptions: {
        timeout: 600000,
        xhrAsync: true,
    },
});
function getModelString(model) {
    let model_data = model.exportGI(null);
    model_data = model_data.replace(/\\/g, "\\\\\\"); // TODO temporary fix
    return model_data;
}
async function runJavascriptFile(event) {
    const funcs = await mobius_sim_funcs_1;
    const inline = await mobius_inline_funcs_1;
    const p = new Promise((resolve) => {
        node_fetch_1.default(event.file)
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
                args.push(JSON.parse(argStrings[argStrings.length - 1].split("const __modules__")[0].split("async")[0]));
            }
            const val0 = args.map((arg) => arg.name);
            const val1 = args.map((arg) => {
                if (event.parameters && event.parameters.hasOwnProperty(arg.name)) {
                    const numVal = Number(event.parameters[arg.name]);
                    if (!numVal && numVal !== 0) {
                        return event.parameters[arg.name];
                    }
                    return numVal;
                }
                const numVal = Number(arg.value);
                if (!numVal && numVal !== 0) {
                    return arg.value;
                }
                return numVal;
            });
            let prefixString = `async function __main_func(__modules__, __inline__, ` + val0 + `) {\n__debug__ = false;\n__model__ = null;\n`;
            if (event.model) {
                prefixString = `async function __main_func(__modules__, __inline__, ` + val0 + `) {\n__debug__ = false;\n__model__ = ` + event.model + `;\n`;
            }
            const postfixString = `\n}\nreturn __main_func;`;
            const fn = new Function(prefixString + splittedString[1] + postfixString);
            const result = await fn()(funcs.Funcs, inline.Inlines, ...val1);
            result.model = getModelString(result.model);
            console.log(result.model);
            resolve("successful");
        });
    }).catch((err) => {
        throw err;
    });
    return await p;
}
exports.runJavascriptFile = runJavascriptFile;
async function runJavascriptFileTest(event) {
    node_fetch_1.default(event.file)
        .then((res) => {
        if (!res.ok) {
            return "";
        }
        return res.text();
    })
        .then(async (dataFile) => {
        const fn = new Function(dataFile.replace(/\\/g, ""));
        const result = await fn()(mobius_sim_funcs_1.Funcs, mobius_inline_funcs_1.Inlines);
        console.log(result.result);
    });
}
exports.runJavascriptFileTest = runJavascriptFileTest;
async function testExecuteJSFile(file, model = null, params = null) {
    const splittedString = file.split("/** * **/");
    const argStrings = splittedString[0].split("// Parameter:");
    const args = [];
    if (argStrings.length > 1) {
        for (let i = 1; i < argStrings.length - 1; i++) {
            args.push(JSON.parse(argStrings[i]));
        }
        args.push(JSON.parse(argStrings[argStrings.length - 1].split("const __modules__")[0].split("async")[0]));
    }
    const val0 = args.map((arg) => arg.name);
    const val1 = args.map((arg) => {
        if (params && params.hasOwnProperty(arg.name)) {
            return params[arg.name];
        }
        const numVal = Number(arg.value);
        if (!numVal && numVal !== 0) {
            return arg.value;
        }
        return numVal;
    });
    let prefixString = `async function __main_func(__modules__, __inline__, ` + val0 + `) {\n__debug__ = false;\n__model__ = null;\n`;
    if (model) {
        prefixString = `async function __main_func(__modules__, __inline__, ` + val0 + `) {\n__debug__ = false;\n__model__ = \`${model}\`;\n`;
    }
    const postfixString = `\n}\nreturn __main_func;`;
    const fn = new Function(prefixString + splittedString[1] + postfixString);
    const result = await fn()(mobius_sim_funcs_1.Funcs, mobius_inline_funcs_1.Inlines, ...val1);
    return result;
}
async function testGenEval(event) {
    const promiseList = [];
    let genFile;
    let evalFile;
    promiseList.push(new Promise((resolve) => {
        node_fetch_1.default(event.genFile)
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
    }));
    promiseList.push(new Promise((resolve) => {
        node_fetch_1.default(event.evalFile)
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
    }));
    await Promise.all(promiseList);
    const genResult = await testExecuteJSFile(genFile, null, event.genParams);
    const genModel = getModelString(genResult.model);
    const evalResult = await testExecuteJSFile(evalFile, genModel, null);
    console.log(evalResult.result);
    return "successful";
}
exports.testGenEval = testGenEval;
async function runGen(data) {
    if (!data.genUrl || !data.evalUrl) {
        return { __success__: false, __error__: 'Gen Error: gen file or eval file URLs are not provided.' };
    }
    const p = new Promise(async (resolve) => {
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
                args.push(JSON.parse(argStrings[argStrings.length - 1].split("const __modules__")[0].split("async")[0]));
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
                const numVal = Number(arg.value);
                if (!numVal && numVal !== 0) {
                    return arg.value;
                }
                return numVal;
            });
            // const addedString = `__debug__ = false;\n__model__ = null;\n` const fn = new
            // Function('__modules__', ...val0, addedString + splittedString[1]); const
            // result = fn(Modules, ...val1); const model =
            // JSON.stringify(result.model.getData()).replace(/\\/g, '\\\\');
            const prefixString = `async function __main_func(__modules__, __inline__, ` + val0 + `) {\n__debug__ = false;\n__model__ = null;\n`;
            const postfixString = `\n}\nreturn __main_func;`;
            const fn = new Function(prefixString + splittedString[1] + postfixString);
            const result = await fn()(mobius_sim_funcs_1.Funcs, mobius_inline_funcs_1.Inlines, ...val1);
            const model = getModelString(result.model).replace(/\\/g, "");
            let checkModelDB = false;
            let checkParamDB = false;
            S3_HANDLER.putObject({
                Bucket: process.env.STORAGE_MOBIUSEVOUSERFILES_BUCKETNAME,
                Key: "public/" + data.owner + "/" + data.JobID + "/" + data.id + ".gi",
                Body: model,
                ContentType: "text/plain",
            }, function (err, result) {
                if (err) {
                    console.log("Error placing gen model:", err);
                    resolve({ __success__: false, __error__: 'Gen Error: Unable to place Gen Model onto S3.' });
                }
                else {
                    console.log("successfully placed model");
                    checkModelDB = true;
                    if (checkParamDB) {
                        resolve({ __success__: true });
                    }
                }
            });
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
                }
                else {
                    console.log("successfully placed data");
                    checkParamDB = true;
                    if (checkModelDB) {
                        console.log("ending function (data side)...");
                        resolve({ __success__: true });
                    }
                }
            });
        }
        catch (ex) {
            resolve({ __success__: false, __error__: 'Gen Error: ' + ex.message });
        }
    });
    return await p;
}
exports.runGen = runGen;
async function runEval(recordInfo) {
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
                args.push(JSON.parse(argStrings[argStrings.length - 1].split("const __modules__")[0].split("async")[0]));
            }
            const val0 = args.map((arg) => arg.name);
            const val1 = args.map((arg) => arg.value);
            const prefixString = `async function __main_func(__modules__, __inline__, ` + val0 + ") {\n__debug__ = false;\n__model__ = `" + data + "`;\n";
            const postfixString = `\n}\nreturn __main_func;`;
            const fn = new Function(prefixString + splittedString[1] + postfixString);
            const result = await fn()(mobius_sim_funcs_1.Funcs, mobius_inline_funcs_1.Inlines, ...val1);
            const model = getModelString(result.model).replace(/\\/g, "");
            S3_HANDLER.putObject({
                Bucket: process.env.STORAGE_MOBIUSEVOUSERFILES_BUCKETNAME,
                Key: "public/" + recordInfo.owner + "/" + recordInfo.JobID + "/" + recordInfo.id + "_eval.gi",
                Body: model,
                ContentType: "text/plain",
            }, function (err, data) {
                if (err) {
                    console.log("Error placing eval model:", err);
                    resolve({ __error__: err.message });
                }
                else {
                    console.log("successfully placed eval model");
                    resolve(result.result);
                }
            });
        }
        catch (ex) {
            console.log('error catched:', ex);
            resolve({ __error__: 'Eval Error: ' + ex.message });
        }
    });
    const result = await p;
    console.log("eval result:", result);
    return result;
}
exports.runEval = runEval;
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
                }
                else if (existing_design.params[param.name] === param.max) {
                    pos_neg = -1;
                }
                let num_steps;
                if (pos_neg < 0) {
                    num_steps = (existing_design.params[param.name] - param.min) / param.step;
                }
                else {
                    num_steps = (param.max - existing_design.params[param.name]) / param.step;
                }
                const c = mutation_sd + GAUSSIAN_STEP_ADJUSTMENT / (num_steps + 1);
                const gaussian_mutation_val = Math.pow(Math.E, -1 * Math.pow(Math.random(), 2) / (2 * Math.pow(c, 2)));
                const added_val = pos_neg * Math.floor(gaussian_mutation_val * (num_steps + 1));
                const existing_step = (existing_design.params[param.name] - param.min) / param.step;
                new_param[param.name] = param.min + (existing_step + added_val) * param.step;
            }
            else {
                new_param[param.name] = existing_design.params[param.name];
            }
        }
        new_design.params = new_param;
        if (existingParams[new_design.genUrl]) {
            let duplicateCheck = false;
            for (const existingParam of existingParams[new_design.genUrl]) {
                let isDuplicate = true;
                for (const param of paramMap[new_design.genUrl]) {
                    if (new_param[param.name] !== existingParam[param.name]) {
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
                console.log('duplicate param:', new_param);
                if (failCount >= MUTATE_FAILURE_THRESHOLD) {
                    existingParams[new_design.genUrl].push(new_param);
                    break;
                }
                // c = c + ((1 - c) * GAUSSIAN_CONSTANT_INCREMENT);
                failCount += 1;
                continue;
            }
            else {
                existingParams[new_design.genUrl].push(new_param);
                break;
            }
        }
        else {
            existingParams[new_design.genUrl] = [];
            existingParams[new_design.genUrl].push(new_param);
            break;
        }
        break;
    }
    return new_design;
}
function checkDuplicateDesign(newDesign, allParams) {
    for (const existingParam of allParams) {
        if (newDesign.genUrl === existingParam.genUrl && newDesign.params === existingParam.params) {
            return true;
        }
    }
    return false;
}
// function getRandomDesign(designList, tournamentSize, eliminateSize) { }
function tournamentSelect(liveDesignList, deadDesignList, population_size, settings_tournament_size) {
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
                liveDesignList.splice(j, 1);
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
async function getGenEvalFile(fileUrl) {
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
                }
                else {
                    resolve(data.Body.toString("utf-8"));
                }
            });
        }
        else {
            const request = new xmlhttprequest_1.XMLHttpRequest();
            request.open("GET", fileUrl);
            request.onload = async () => {
                if (request.status === 200) {
                    resolve(request.responseText);
                }
                else {
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
async function updateJobDB(jobID, run, status, history) {
    const jobDBUpdatePromise = new Promise((resolve) => {
        const runStart = history[history.length - 1].runStart;
        const runEnd = new Date();
        if (history.length > 0) {
            //@ts-ignore
            history[history.length - 1].runTime = (runEnd - runStart) / 1000;
            history[history.length - 1].runEnd = runEnd;
            history[history.length - 1].status = status;
        }
        DYNAMO_HANDLER.update({
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
        }, (err, record) => {
            if (err) {
                console.log("error updating job db", err);
                resolve(false);
            }
            else {
                console.log("successfully updating job db");
                resolve(true);
            }
        });
    }).catch((err) => {
        console.log("job db update error", err);
        throw err;
    });
    await jobDBUpdatePromise;
}
async function getJobEntries(jobID, allEntries, liveEntries, existingParams) {
    const p = new Promise((resolve) => {
        DYNAMO_HANDLER.query({
            TableName: process.env.API_MOBIUSEVOGRAPHQL_GENEVALPARAMTABLE_NAME,
            IndexName: "byJobID",
            KeyConditionExpression: "JobID = :job ",
            ExpressionAttributeValues: {
                ":job": jobID,
            },
        }, function (err, response) {
            if (err) {
                console.log("Error retrieving parent data:", err);
                resolve(null);
            }
            else {
                resolve(response.Items);
            }
        });
    }).catch((err) => {
        throw err;
    });
    let prevItems = await p;
    if (!prevItems) {
        return;
    }
    prevItems.forEach((item) => {
        if (typeof item.params === "string") {
            item.params = JSON.parse(item.params);
        }
        allEntries.push(item);
        if (!existingParams[item.genUrl]) {
            existingParams[item.genUrl] = [];
        }
        existingParams[item.genUrl].push(item.params);
    });
    prevItems = prevItems.filter((item) => item.live === true);
    prevItems = prevItems.sort((a, b) => {
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
    const event = aws_sdk_1.default.DynamoDB.Converter.unmarshall(record.dynamodb.OldImage);
    console.log("Unmarshalled Record to be removed:", event);
    const paramsQuery = {
        TableName: process.env.API_MOBIUSEVOGRAPHQL_GENEVALPARAMTABLE_NAME,
        IndexName: "byJobID",
        KeyConditionExpression: "JobID = :job ",
        ExpressionAttributeValues: {
            ":job": event.id,
        },
    };
    async function queryParams() {
        const p = new Promise(resolve => {
            DYNAMO_HANDLER.query(paramsQuery, onQuery);
            async function onQuery(err, data) {
                if (err) {
                    console.error("Unable to scan the table. Error JSON:", JSON.stringify(err, null, 2));
                }
                else {
                    // print all the movies
                    console.log("Query succeeded.");
                    console.log("  ", data.Count);
                    data.Items.forEach(function (param) {
                        deleteObjectPromises.push(DYNAMO_HANDLER.delete({
                            TableName: process.env.API_MOBIUSEVOGRAPHQL_GENEVALPARAMTABLE_NAME,
                            Key: {
                                id: param.id
                            }
                        }).promise());
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
        });
        return p;
    }
    getItemsPromises.push(queryParams());
    const s3Query = {
        Bucket: process.env.STORAGE_MOBIUSEVOUSERFILES_BUCKETNAME,
        Prefix: `public/${event.owner}/${event.id}`,
    };
    const allKeys = [];
    async function listAllKeys() {
        const p = new Promise(resolve => S3_HANDLER.listObjectsV2(s3Query, async function (err, data) {
            if (err) {
                console.log(err, err.stack); // an error occurred
            }
            else {
                const contents = data.Contents;
                if (contents.length > 0) {
                    const keyList = [];
                    contents.forEach(function (content) {
                        allKeys.push(content.Key);
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
                    }).promise());
                }
                if (data.IsTruncated) {
                    s3Query.ContinuationToken = data.NextContinuationToken;
                    console.log("get further list...");
                    await listAllKeys();
                }
            }
            resolve(null);
        }));
        return p;
    }
    getItemsPromises.push(listAllKeys());
    await Promise.all(getItemsPromises);
    await Promise.all(deleteObjectPromises);
    console.log('allKeys count:', allKeys.length);
}
async function runGenEvalController(input) {
    console.log("~~~ input: ", input);
    const record = input.Records[0];
    if (record.eventName !== "INSERT" && record.eventName !== "MODIFY") {
        if (record.eventName === "REMOVE") {
            await removeJobData(record);
        }
        return;
    }
    console.log("DynamoDB Record: %j", record.dynamodb);
    const event = aws_sdk_1.default.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);
    console.log("Unmarshalled Record:", event);
    if (!event.genUrl || !event.evalUrl || !event.run) {
        return false;
    }
    if (typeof event.genUrl === "string") {
        return false;
    }
    const population_size = event.population_size;
    const max_designs = event.max_designs;
    const tournament_size = event.tournament_size;
    const mutation_sd = event.mutation_sd ? event.mutation_sd : 0.05;
    const history = [{
            runStart: new Date(),
            runEnd: null,
            runTime: null,
            population_size: population_size,
            max_designs: max_designs,
            tournament_size: tournament_size,
            mutation_sd: mutation_sd,
            genUrl: event.genUrl,
            evalUrl: event.evalUrl
        }];
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
            DYNAMO_HANDLER.get({
                TableName: process.env.API_MOBIUSEVOGRAPHQL_JOBTABLE_NAME,
                Key: {
                    id: event.id,
                },
            }, (err, record) => {
                if (err) {
                    console.log(err);
                    resolve(null);
                }
                else {
                    console.log("... run check for", event.id, "; items:", record);
                    resolve(record.Item);
                }
            });
        }).catch((err) => {
            throw err;
        });
        const jobItem = await getJobPromise;
        const runCheck = jobItem.run;
        if (!updatedPastHistory) {
            try {
                if (jobItem.history) {
                    const pastHistory = JSON.parse(jobItem.history);
                    pastHistory.forEach(historyItem => history.splice(history.length - 1, 0, historyItem));
                }
                updatedPastHistory = true;
            }
            catch (ex) { }
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
            let mutationNumber = (liveEntries.length < (max_designs - designCount)) ? liveEntries.length : (max_designs - designCount);
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
            promiseList.push(new Promise((resolve) => {
                const entryBlob = JSON.stringify(entry);
                // run gen
                LAMBDA_HANDLER.invoke({
                    FunctionName: process.env.FUNCTION_EVOGENERATE_NAME,
                    Payload: entryBlob,
                }, (err, genResponse) => {
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
                    LAMBDA_HANDLER.invoke({
                        FunctionName: process.env.FUNCTION_EVOEVALUATE_NAME,
                        Payload: entryBlob,
                    }, (err, evalResponse) => {
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
                        }
                        catch (ex) {
                            console.log("failed parsing evalResult", entry.params);
                            resolve({
                                success: false,
                                id: entry.id,
                                error: "Eval Error: failed parsing evalResult"
                            });
                        }
                    });
                });
            }).catch((err) => {
                throw err;
            }));
        }
        // wait for all promises to be resolved
        await Promise.all(promiseList).then((results) => {
            console.log('execute results:', results);
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
                                });
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
            }
            else {
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
                    }
                    else {
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
                        }
                        else {
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
    }
    else {
        await updateJobDB(event.id, false, "completed", history);
    }
    console.log("process complete");
    return true;
}
exports.runGenEvalController = runGenEvalController;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NyYy9tYWluLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLHNEQUEwQjtBQUMxQiw0REFBK0I7QUFDL0IsbURBQWdEO0FBQ2hELDBFQUE0RDtBQUM1RCxnRkFBaUU7QUFFakU7O0dBRUc7QUFFSCxNQUFNLGlCQUFpQixHQUFHLElBQUksQ0FBQztBQUMvQixNQUFNLHdCQUF3QixHQUFHLEdBQUcsQ0FBQztBQUNyQyxNQUFNLDJCQUEyQixHQUFHLElBQUksQ0FBQztBQUV6QyxNQUFNLHdCQUF3QixHQUFHLEVBQUUsQ0FBQztBQUNwQyxNQUFNLDRCQUE0QixHQUFHLEVBQUUsQ0FBQztBQUV4Qzs7R0FFRztBQUVILE1BQU0sY0FBYyxHQUFHLElBQUksaUJBQUcsQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxDQUFDLENBQUM7QUFDaEYsTUFBTSxVQUFVLEdBQUcsSUFBSSxpQkFBRyxDQUFDLEVBQUUsRUFBRSxDQUFDO0FBQ2hDLE1BQU0sY0FBYyxHQUFHLElBQUksaUJBQUcsQ0FBQyxNQUFNLENBQUM7SUFDbEMsTUFBTSxFQUFFLFdBQVc7SUFDbkIsV0FBVyxFQUFFO1FBQ1QsT0FBTyxFQUFFLE1BQU07UUFDZixRQUFRLEVBQUUsSUFBSTtLQUNqQjtDQUNKLENBQUMsQ0FBQztBQUVILFNBQVMsY0FBYyxDQUFDLEtBQVU7SUFDOUIsSUFBSSxVQUFVLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN0QyxVQUFVLEdBQUcsVUFBVSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQyxxQkFBcUI7SUFDdkUsT0FBTyxVQUFVLENBQUM7QUFDdEIsQ0FBQztBQUNNLEtBQUssVUFBVSxpQkFBaUIsQ0FBQyxLQUFzRDtJQUMxRixNQUFNLENBQUMsR0FBRyxJQUFJLE9BQU8sQ0FBQyxD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