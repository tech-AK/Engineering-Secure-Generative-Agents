
// taken from: https://github.com/vuejs/core/issues/2627#issuecomment-799364296
declare module "*.vue" {
    import { defineComponent } from 'vue';

    const component: ReturnType<typeof defineComponent>;
    export default component;
}
