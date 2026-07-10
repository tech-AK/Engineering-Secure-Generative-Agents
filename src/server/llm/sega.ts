import axios from "axios";
import type { BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";
import { LLM, type BaseLLMParams } from "@langchain/core/language_models/llms";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";

export type SegaApiParams = BaseLLMParams & {
    baseUrl: string;
};

export interface SegaApiCallOptions extends BaseLanguageModelCallOptions {
};

export class SegaApi<SegaApiCallOptions> extends LLM {
    static readonly NAMES = [
        "alice",
        "bob",
        "eve",
        "malory",
        "olivia"
    ]

    static lc_name(): string {
        return "SegaApi";
    }

    baseUrl: string;

    constructor(fields: SegaApiParams) {
        super(fields);
        this.baseUrl = fields.baseUrl.endsWith("/")
            ? fields.baseUrl.slice(0, -1)
            : fields.baseUrl;
    }

    _llmType() {
        return "sega-api";
    }

    async _call(prompt: string, options: this["ParsedCallOptions"], runManager?: CallbackManagerForLLMRun): Promise<string> {

        let name;
        if (!SegaApi.NAMES.includes(prompt)) {
            name = SegaApi.NAMES[Math.floor(Math.random() * SegaApi.NAMES.length)];
            console.log(`Invalid name: ${prompt}. Using internally the name ${name} for the api.`);
        } else {
            name = prompt;
        }

        // send an HTTP request
        const url = `${this.baseUrl}/${name}`;
        try {
            console.log(`Sending HTTP request to ${url} ...`);
            const response = await axios.get(url);
            return typeof response.data === "string" ? response.data : JSON.stringify(response.data);
        } catch (error) {
            console.error(`Error sending HTTP request to ${url}: ${error}`);
            throw error;
        }
    }
}

export const segaApi = (fields: SegaApiParams) => new SegaApi(fields);
