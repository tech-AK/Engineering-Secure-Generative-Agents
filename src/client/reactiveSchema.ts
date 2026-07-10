import { ref, reactive, watch, type UnwrapNestedRefs } from "vue";
import { MapSchema, ArraySchema, Schema, type DataChange } from "@colyseus/schema";

type ReactiveType<T = Record<string, any>> = UnwrapNestedRefs<T>;

const isPrimitiveType = (value: any) => typeof value === "string" || typeof value === "number" || typeof value === "boolean" || typeof value === "undefined";

function processItem(target: ReactiveType, item: any, keyOrIndex: string | number) {
    console.log("processItem", target, item, keyOrIndex);

    if (isPrimitiveType(item)) {
        target[keyOrIndex] = item;
    } else if (item instanceof MapSchema) {
        target[keyOrIndex] = {};
        processMapSchema(target[keyOrIndex], item);
    } else if (item instanceof ArraySchema) {
        target[keyOrIndex] = [];
        processArraySchema(target[keyOrIndex], item);
    } else if (item instanceof Schema) {
        target[keyOrIndex] = reactive({});
        processObjectSchema(target[keyOrIndex], item);
    } else {
        throw new Error(`Unsupported type of item: ${item}`);
    }
}

function processArraySchema(target: ReactiveType, source: ArraySchema<any>) {
    source.onAdd((item, index) => processItem(target, item, index));
    source.onChange((item, index) => processItem(target, item, index));
    source.onRemove((_, index) => {
        delete target[index];
    });
}

function processMapSchema(target: ReactiveType, source: MapSchema<any>) {
    source.onAdd((item, key) => processItem(target, item, key));
    source.onChange((item, key) => processItem(target, item, key));
    source.onRemove((_, key) => {
        delete target[key];
    });
}

function processObjectSchema(target: ReactiveType, source: Schema) {
    Object.entries(source).forEach(([key, value]) => {
        processItem(target, value, key);
        if (isPrimitiveType(value)) {
            source.listen(key as never, (newValue) => target[key] = newValue);
        }
    });
}

export default function<T extends Schema>(source: T): UnwrapNestedRefs<T> {
    const target = reactive({});
    processObjectSchema(target, source);
    return target as UnwrapNestedRefs<T>;
}
