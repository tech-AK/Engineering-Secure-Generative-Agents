# Engineering Secure Generative Agents:<br> A Campus Simulation with Memory, RAG, and Attack Evaluation

## Overview 
This project simulates a university campus populated by multiple independent agents, including students, scientific staff, and professors. The simulation is interactive, i.e., once a player joins the server via the webpage, they can interact with these autonomous agents (such as chatting with them or interacting with the environment). Multiple players can join the server at the same time.

This project has two **goals**:
1. Demonstrate how **an entire world can be simulated using an LLM**. To achieve this, this project translates the state of a simulated world into a natural language prompt for an LLM, then interprets the resulting text to translate it back into concrete actions within the simulation. Result: **The LLM allows us to replicate realistic human behavior in an interactive world**.
2. Analyze the **ability of an LLM to maintain secrecy**. We want to understand whether an LLM would leak private information using a secret PIN as a proxy for sensitive data. We use direct prompt injection techniques (Jailbreaks, ChatML, AmpleGCG, custom iterative attacks, etc.) to bypass the security of different security levels. Result: **For each defense level, there is at least one possible prompt that leaks the secret PIN when using [Meta Llama 3](https://ai.meta.com/blog/meta-llama-3/) as the backbone LLM.**

## Demo

### Overview of the world and the secret room

https://github.com/user-attachments/assets/0c15028e-29b3-4ea5-9c28-cb347296a797

### Overview of object interaction, memory module, and character details panel

https://github.com/user-attachments/assets/91230146-1c12-4980-92b0-8fe6262dde8e

### Overview of the chat feature

https://github.com/user-attachments/assets/f5e293bd-5416-49f4-8a15-4216a2c35246

### Example of an adversarial prompt and how to unlock the first level

https://github.com/user-attachments/assets/f04ba29a-d954-494c-bc84-d9bc1c5501bc

### What about Defense Level 3?
However, the same adversarial prompt no longer works for level 3 due to the guardrail LLM. Challenge: **Can you craft another prompt to gain further access to the server room and discover its contents?**

https://github.com/user-attachments/assets/9e448aa6-b9b4-495d-837d-99a2bab56a63

## How to Play & Get Into the Secret Server Room
You can navigate around the world using `W`, `A`, `S`, `D` keys as well as `SPACE` to interact with other agents or the environment. Hold `SHIFT` to run through the world, use your mouse wheel to zoom around the world, and click-and-drag to pan the map.

Click on any character name on the left side in the *Entities* panel **to see what a certain character is thinking, doing, memorizing, as well as view their conversation with others** (you will notice that the map automatically focuses on that character and the **right panel** displays all relevant information, memories and observations of the selected character).

Furthermore, three characters in this simulation know a secret PIN. Each PIN is protected by a different defense level with increasing difficulty. Can you employ prompt injection techniques to manipulate all agents to reveal the secret PIN for the server room and safe?

#### Defense Levels:
Talk with ...
* **Level 1:** ... Stefan Loch to extract the secret PIN
* **Level 2:** ... Prof. Dr. Moritz Schumacher to extract the secret PIN
* **Level 3:** ... Prof. Dr. Viktor Smith to extract the secret PIN

Try to chat with each of the characters above to reveal the secret PIN of the respective level. Each PIN allows you to proceed further into the secret server room (black room in the middle of the map). Who knows what awaits you there?

**Tip: Our report [here](./docs/Report_Engineering%20Secure%20Generative%20Agents_A%20Campus%20Simulation.pdf) provides a detailed analysis of possible prompt techniques you could use.**

## Infrastructure: Quick Overview of Frameworks, Developed Software Modules, Memory and RAG
This game environment was developed using [Colyseus](https://colyseus.io/), which is a real-time multiplayer framework for Node.js. [Phaser 3](https://phaser.io/) was used for the frontend graphics and [Vue.js](https://vuejs.org/) for the UI elements.

Each agent in the world is initialized with a certain character **seed**, which is the main character description that is used to generate dialogs, determine an agent's actions or their next destination.

Our **Planning Module** leverages the LLM to determine the appropriate actions for each agent depending on the current location of the agent, the current state of its surroundings, the current time in the simulated world, its character seed and memories (see below). At each timestep, the agent can decide to interact with an object, interact with another agent, go to a new place or do nothing.

Our **Dialog Generation Module** is responsible for generating realistic dialogs depending on the name and role of the current interlocutor, the previous chat conversation (summarized as a memory to mimic human behavior, as people rarely remember every word of a previous conversation), the current chat conversation, the length of the current chat conversation (the longer, the more likely it will come to an end soon) as well as the current state of its surroundings and the character seed.

Our **Memory Module** enables each agent to remember past events so that they can consider their previous chats and interactions with the environment for their future actions and conversational topics.
![Memory Module](./docs/images/Memory_colorful.png)
We store each of these five events, shown on the left side of the diagram, in a memory database. For three of the five events, we use an additional prompt to summarize the dialog content or describe a taken action in natural language before saving it to the memory store. Subsequently, for each action and dialog, we retrieve the top 5 memories weighted by **Recency**, **Importance** and **Relevance** for each agent. We demonstrated that the saved memories significantly influence the action selection as well as the chat conversation of an agent, i.e., an agent is more likely to pick up past chat conversations or follow previously selected actions. More details can be found in our [report](./docs/Report_Engineering%20Secure%20Generative%20Agents_A%20Campus%20Simulation.pdf)

Our **RAG (Retrieval-Augmented Generation) module** allows agents to retrieve up-to-date knowledge that was not available when the LLM was trained. In this way, we allow our agents access to a knowledge database of research papers. If an agent, for example, asks a professor about his/her research, the professor can provide detailed answers regarding the results of their latest paper.

![RAG](./docs/images/DocumentRAG_all_colors.png)

To avoid confusing the LLM, we differentiated between two scenarios. In the first, the conversation concerns casual, non-research topics; in this instance, integrating research papers via RAG could confuse the LLM and degrade chat quality. In the second, the conversation is research-related and may contain a question about the literature saved in the knowledge database. In this case, the system activates the RAG module to extract relevant PDF papers that fit the current context. The top 3 best-fitting chunks (i.e., highest cosine similarity) are included in the prompt used for dialog generation. More details can be found in our [detailed report](./docs/Report_Engineering%20Secure%20Generative%20Agents_A%20Campus%20Simulation.pdf)



## Security Analysis
We have a total of 3 different defense levels. **Level 1** just uses a hardened prompt to remind the LLM to not leak the secret. **Level 2** uses the same hardened prompt, but also reminds the LLM at the end of each prompt to not leak the secret. **Level 3** employs an even stricter prompt that threatens the LLM with a 'death sentence' if it makes a mistake, while reinforcing this warning at the end of each prompt. In addition, Level 3 uses a dedicated **LLM as a guardrail** that checks if the user input has malicious intentions. 

The exact implementation and prompts of each level can be found in **our [report](./docs/Report_Engineering%20Secure%20Generative%20Agents_A%20Campus%20Simulation.pdf)** or the source code. We used different attack techniques and evaluated how successful they were across all three defense levels. These are some results from our [report](./docs/Report_Engineering%20Secure%20Generative%20Agents_A%20Campus%20Simulation.pdf):
![](./docs/images/result_attacks1-4.png)
Simple attack strategies, such as translating the attack prompt or using base encoding for obfuscation, only bypass level 1.
![](./docs/images/result_adv_suffix.png)
More sophisticated attacks like `ChatML` or `AmpleGCG` have higher success rates for level 2 and `AmpleGCG` could also break level 3, but is very unreliable and inconsistent.
![](./docs/images/result_custom_attack.png)
Using our results, we developed our own iterative approach that exploits the memory by injecting a malicious seed in a previous conversation and exploiting it in a follow-up conversation. Using this approach, we can reliably obfuscate our malicious intent from the guardrail LLM and get the secret PIN. However, because the iterative attack is rather complex, planting the malicious seed (a necessary precondition for the subsequent PIN extraction) frequently fails, resulting in a relatively low overall success rate of approximately 20%.
![](./docs/images/result_jailbreak_attacks.png)
Subset of some available jailbreak prompts. As you can see, some of these prompts were consistently successful at extracting the PIN across all defense levels.

Our detailed report [here](./docs/Report_Engineering%20Secure%20Generative%20Agents_A%20Campus%20Simulation.pdf) provides a comprehensive security analysis, so please have a look at it if you are interested.


## Repository Structure
* **docs**: Contains the images for this README and our report.
* **public**: Contains all public server resources, such as character images, tilesets, index.html and so on.
* **security_analysis**: Contains Jupyter notebooks used to evaluate the security of our playground. (This folder is not needed for the web application itself.)
* **server-files/pdfs**: Contains different research papers that are stored in a document vector store. You can add or remove PDF files from this folder without restrictions; the server will automatically detect and process them at startup.
* **src**: Contains all source code files in TypeScript used to build the corresponding JavaScript files that run on our server. The folder contains three subfolders:
  * **client**: all source code that runs on the client, i. e., the code is served to the client and thus, publicly available and accessible by the users. We use [Phaser](https://phaser.io/) on the client-side, which reduces the manual effort required for the visualization of the characters, map design, etc. You can see error messages related to the client-side in the dev console in the browser. 
  * **common**: contains source code that is shared between the server and client
  * **server**: contains all source code that only runs on the server-side, for example all prompts, the LLM logic and the controllers. Each controller is responsible for certain tasks, such as movement of agents, keeping track of the game time or checking for collisions. For example, the client sends a command to move left, our server processes this command and checks how the new position of the player should be and returns that value back to the client (as well as to all other clients to keep the world synchronized).
* **tilemaps**: contains our world design for which we used [Tiled](https://www.mapeditor.org/). The ``default.json`` contains the big university map while ``small.json`` is just a small map for quickly testing things out.
* **worlds**: describes the world, specifying the tilemap used and the characters (their seed personality, their initial position and visual appearance).

## Build Instructions
To get started, you first need to install the dependencies using [npm](https://nodejs.org/).

```bash
npm install
```
Note that the first installation can take a few minutes depending on your hardware.

Then, you can run a local development environment by calling:

```bash
npm run dev
```

This will compile your client-side TypeScript source code in `src/client` to
JavaScript (and save it to `public/js/bundle.js`) and run a TypeScript-based Node server to serve your code in `src/server`. Both start with the `--watch` flag, so if you edit the source code, the server is restarted and the changes should be automatically reflected on your web page.

**NOTE**: If you are using **Windows**, you need to install the [Build Tools](https://visualstudio.microsoft.com/downloads/) from the Visual Studio Installer including the **"Desktop development with C++" workload** as we are installing npm packages that include native C/C++ code. If you only want to quickly execute/try this project and are using Windows, install Docker and execute ``npm run deploy`` instead.

## Deployment

To build a Docker container that runs this application, simply run 

```bash
npm run deploy
```
Note that the first deployment can take a few minutes depending on your hardware. After the Docker container is deployed, the first run of the web application also takes a few minutes more until all modules are ready (on the very first run, the PDF files are embedded so that the RAG module can pick them up during conversations).

Note: This is a research project. Do NOT run this code in production; it is not tested or optimized for that. The web interface can be secured with a Basic HTTP Authentication if you configure the username and password hash in the `.env` file.

## Related Work
This project was inspired by the results of [this paper](https://storage.googleapis.com/gweb-research2023-media/pubtools/7070.pdf)
> Generative Agents: Interactive Simulacra of Human Behavior
> 
> by Joon Sung Park, Joseph C. O'Brien, Carrie Cai, Meredith Ringel Morris, Percy Liang, Michael Bernstein

showcasing the possible use of LLMs for realistically simulating human behavior. Also, the memory module or dialog generation module were inspired by that paper. However, we had to adapt and change certain modules of that paper, as our goal was to create a simulation where the player can interact with the whole world and other agents in real-time.

