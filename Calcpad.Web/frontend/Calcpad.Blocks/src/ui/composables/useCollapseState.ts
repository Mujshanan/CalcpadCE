import { computed, ref } from 'vue';

export function useCollapseState() {
    const collapsed = ref<Record<number, boolean>>({});
    const isCollapsed = (projectionIndex: number): boolean => collapsed.value[projectionIndex] === true;

    function setCollapsed(projectionIndex: number, value: boolean): void {
        collapsed.value = { ...collapsed.value, [projectionIndex]: value };
    }
    function toggle(projectionIndex: number): void {
        setCollapsed(projectionIndex, !isCollapsed(projectionIndex));
    }
    function expand(projectionIndex: number): void {
        setCollapsed(projectionIndex, false);
    }
    function collapse(projectionIndex: number): void {
        setCollapsed(projectionIndex, true);
    }

    const entries = computed(() => collapsed.value);
    return { collapsed: entries, isCollapsed, setCollapsed, toggle, expand, collapse };
}
