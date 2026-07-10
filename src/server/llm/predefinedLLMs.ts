import { Ollama } from "@langchain/community/llms/ollama";
import { OllamaInput } from "@langchain/community/llms/ollama";
import { BaseLLMParams } from "@langchain/core/language_models/llms";
import {ChatOpenAI, OpenAIChatInput} from "@langchain/openai";

type OllamaParams = OllamaInput & BaseLLMParams;
type ChatGPTParams = Partial<OpenAIChatInput> & BaseLLMParams;

export const llama2 = (fields: OllamaParams) => new Ollama({ ...fields, model: "llama2" });
export const llama3 = (fields: OllamaParams) => new Ollama({ ...fields, model: "llama3" });
export const llama3_70b = (fields: OllamaParams) => new Ollama({ ...fields, model: "llama3:70b" });


export const chatGPT = (fields: ChatGPTParams) => new ChatOpenAI({...fields});
