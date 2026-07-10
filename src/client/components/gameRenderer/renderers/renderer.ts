import { Client } from "colyseus.js";
import { Schema } from "@colyseus/schema";
import Vector2 from "../../../../common/utils/vector";
import Direction from "../../../../common/utils/direction";
import GameScene from "../gamescene";

interface GameObjectState extends Schema {
    position: Schema & { x: number, y: number };
};

export abstract class ResourceLoader {
    static readonly TILE_SIZE = 16;

    constructor(protected scene: Phaser.Scene) {
        // invoke the preload method
        this.preload();
    }

    abstract preload(): void;
    abstract create(): void;

    createDirectionalAnimation(imageName: string, animationName: string, start: number, numFrames: number = 6, config: Phaser.Types.Animations.Animation = { frameRate: 8, repeat: -1 }) {
        const defaultConfig = {
            frameRate: 8,
            repeat: -1
        };

        this.scene.anims.create({
            key: `${animationName}-right`,
            frames: this.scene.anims.generateFrameNumbers(imageName, { start: start, end: start + numFrames - 1 }),
            ...defaultConfig,
            ...config
        });
        this.scene.anims.create({
            key: `${animationName}-up`,
            frames: this.scene.anims.generateFrameNumbers(imageName, { start: start + numFrames, end: start + numFrames * 2 - 1 }),
            ...defaultConfig,
            ...config
        });
        this.scene.anims.create({
            key: `${animationName}-left`,
            frames: this.scene.anims.generateFrameNumbers(imageName, { start: start + numFrames * 2, end: start + numFrames * 3 - 1 }),
            ...defaultConfig,
            ...config
        });
        this.scene.anims.create({
            key: `${animationName}-down`,
            frames: this.scene.anims.generateFrameNumbers(imageName, { start: start + numFrames * 3, end: start + numFrames * 4 - 1 }),
            ...defaultConfig,
            ...config
        });
    }
}

export abstract class Renderer<S extends GameObjectState, L extends ResourceLoader> {
    static readonly TILE_SIZE = 16;

    constructor(protected scene: GameScene, protected client: Client, protected state: S, protected loader: L) {
        // add default listeners
        this.state.onRemove(() => this.destroy());
    }

    abstract create(): Promise<void> | void;
    abstract destroy(): Promise<void> | void;
    abstract update(delta: number): Promise<void> | void;

    protected abstract get spritePosition(): Vector2;
    protected abstract set spritePosition(position: Vector2);

    protected get serverPosition(): Vector2 {
        return new Vector2(this.state.position).multiply(Renderer.TILE_SIZE);
    }

    protected setDirectionalAnimation(sprite: Phaser.GameObjects.Sprite, name: string, direction: Direction, config: Omit<Phaser.Types.Animations.PlayAnimationConfig, "key"> = {}) {
        // append the direction suffix
        let key = name + `-${Direction[direction].toLowerCase()}`;

        // play the requested animation
        sprite.anims.play({
            key,
            ...config
        });
    }

    protected async getProperty<P extends keyof S>(property: P): Promise<S[P]> {
        return new Promise<any>((resolve) => {
            this.state.listen(property as any, (value) => {
                if (value !== undefined) {
                    resolve(value);
                }
            }, true);
        });
    }

    updateWrapper(delta: number) {
        // make sure the position is available
        if (!this.state.position) {
            return;
        }

        // interpolate sprite position to smooth out server updates
        const alpha = 0.97;
        this.spritePosition = this.spritePosition.lerp(this.serverPosition, 1 - Math.pow(alpha, delta));

        // invoke subclass update method
        this.update(delta);
    }
}
