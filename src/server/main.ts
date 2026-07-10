import dotenv from "dotenv";
dotenv.config();

import express from "express";
import proxy from "express-http-proxy";
import path from "path";
import assert from "assert";
import cors from "cors";
import fs from "fs";
import util from "util";
import YAML from "yaml";

import { GameRoom } from "./rooms/gameroom";
import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { createServer } from "http";
import { segaApi } from "./llm/sega";
import {chatGPT, llama3} from "./llm/predefinedLLMs";
import auth from "./auth";

import * as cmd from "cmd-ts";
import { File as FileType } from "cmd-ts/batteries/fs";

import { importTest } from "../common/importtest";
import RetrievalAugmentedGeneration from "./llm/retrievalAugmentedGeneration";
import {ChainGenerator} from "./llm/chainGenerator";
import AgentMemoryVectorStore from "./llm/AgentMemoryVectorStore";
assert(importTest());

// globaL unhandled promise rejection handler (try to keep running)
process.on("unhandledRejection", (reason, promise) => {
    console.error(`Unhandled Rejection at ${promise} with reason: ${reason}`);
});

function redirect_log_to_file() {
    var log_file = fs.createWriteStream(__dirname + '/../../server-files/debug.log', {flags : 'w'});
    var log_stdout = process.stdout;

    console.log = function(d) { //
        log_file.write(util.format(d) + '\n');
        //log_stdout.write(util.format(d) + '\n');
    };

    console.error = function(d) { //
        log_file.write(util.format(d) + '\n');
        log_stdout.write(util.format(d) + '\n');
    };
}

async function main({ world }: any) {
    const app = express();
    const port = parseInt(process.env.PORT ?? "8080");
    const serverUrl = process.env.SERVER_URL ?? `http://localhost:${port}`;

    // setup basic auth
    app.use(auth);

    // setup cors
    app.use(cors({
        origin: serverUrl,
        optionsSuccessStatus: 200
    }));

    // setup static file serving
    app.get("/", express.static(path.join("public", "html")));
    app.use("/static/", express.static(path.join("public", "static")));
    app.use("/js/", express.static(path.join("public", "js")));

    if (!process.env.LLM_BASE_URL) {
        throw new Error("LLM_BASE_URL not set");
    }

    // setup the llm
    // const llm = segaApi({ baseUrl: process.env.LLM_BASE_URL });
    const llm = llama3({
        baseUrl: process.env.LLM_BASE_URL,
        temperature: 0
    });

    // forward requests to /ollama/... to the llama3 API
    app.use("/ollama", proxy(process.env.LLM_BASE_URL!));

    const chainGenerator = new ChainGenerator(llm);
    const globalAgentMemoryVectorStore = new AgentMemoryVectorStore();
    await globalAgentMemoryVectorStore.init();

    /*const llm = chatGPT({
        apiKey: process.env.OPENAI_API_KEY,
    });*/

    const gameServer = new Server({
        transport: new WebSocketTransport({
            server: createServer(app),
        }),
        greet: false
    });

    // load the world description
    const worldFilename = path.resolve(world);
    const worldDescription = YAML.parse(await fs.promises.readFile(worldFilename, "utf-8"));

    /**
     * Define your room handlers:
     */
    gameServer.define("GameRoom", GameRoom, { worldDescription, llm, chainGenerator, globalAgentMemoryVectorStore });
    gameServer.listen(port);

    //Writing console log to a debug.log file in order to better keep track of the logs //Use only locally on the PC
    //redirect_log_to_file();

    console.log(`Listening on ${serverUrl}`);
}

// wrap main function in argument parser
const runner = cmd.command({
    name: "sega-server",
    args: {
        /* map: cmd.option({
            type: FileType,
            long: "map",
            short: "m",
            defaultValue: () => "tilemaps/default.json"
        }), */
        world: cmd.option({
            type: FileType,
            long: "world",
            short: "w",
            defaultValue: () => "worlds/default.yaml"
        })
    },
    handler: main
});
cmd.run(runner, process.argv.slice(2));
