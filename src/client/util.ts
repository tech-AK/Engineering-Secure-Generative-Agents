export function $<ElementType>(a: string) {
    return document.getElementById(a) as ElementType;
}

export function $0<ElementType>(a: string) {
    return document.querySelector(a) as ElementType;
}

export function $$(a: string) {
    return document.querySelectorAll(a);
}
