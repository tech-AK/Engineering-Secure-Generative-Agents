import Phaser from "phaser";
import Agent, { AgentState } from "../../../../common/state/agent";
import Direction from "../../../../common/utils/direction";
import Vector2 from "../../../../common/utils/vector";
import {Renderer, ResourceLoader} from "./renderer";
import {Client} from "colyseus.js";
import AgentFilenames from "../../../../common/utils/agent_filenames";

export class AgentResourceLoader extends ResourceLoader {

    preload() {
        // load default character spritesheet
        for (let i = 0; i < AgentFilenames.length; i++) {
            const id = i.toString().padStart(2, '0');
            this.scene.load.spritesheet(`agent-${AgentFilenames[i]}`, `static/images/characters/${AgentFilenames[i]}.png`, {
                frameWidth: ResourceLoader.TILE_SIZE,
                frameHeight: ResourceLoader.TILE_SIZE * 2
            });
            // console.log(`static/images/characters/${AgentFilenames[i]}.png`)
        }
    }

    create() {
        // add all animations
        for (let i = 0; i < AgentFilenames.length; i++) {
            const tilesetId = `agent-${AgentFilenames[i]}`;
            this.createDirectionalAnimation(tilesetId, `${tilesetId}-idle`, 56, 6, {frameRate: 4, repeat: -1});
            this.createDirectionalAnimation(tilesetId, `${tilesetId}-walk`, 112, 6, {frameRate: 13, repeat: -1});
        }
    }
}

export default class AgentRenderer extends Renderer<Agent, AgentResourceLoader> {
    static readonly TILE_SIZE = 16;

    tilesetId!: string;
    sprite!: Phaser.GameObjects.Sprite;

    create() {
        this.tilesetId = "agent-" + this.state.characterImage;

        const initialPosition = this.serverPosition;
        this.sprite = this.scene.add.sprite(initialPosition.x, initialPosition.y, this.tilesetId, 0)
            .setOrigin(0, 0.5)
            .setSize(1, 2);

        // update sprite animation on velocity and direction change
        this.state.velocity.onChange(() => {
            this.updateAnimation();
        });
        this.state.listen("direction", () => {
            this.updateAnimation();
        })

        // set initial update
        this.updateAnimation();
    }

    destroy() {
        this.sprite.destroy();
    }

    update(delta: number) {
    }

    updateAnimation() {
        const moving = this.state.velocity.x !== 0 || this.state.velocity.y !== 0;

        if (moving) {
            this.setDirectionalAnimation(this.sprite, `${this.tilesetId}-walk`, this.state.direction);
        } else {
            // start idle animation on a random frame
            this.setDirectionalAnimation(this.sprite, `${this.tilesetId}-idle`, this.state.direction, {
                startFrame: Math.floor(Math.random() * 6)
            });
        }
    }

    get spritePosition(): Vector2 {
        return new Vector2(this.sprite.x, this.sprite.y);
    }

    set spritePosition(position: Vector2) {
        this.sprite.setPosition(position.x, position.y);
    }
}
