// Public surface of the Calcpad.Blocks UI layer.
//
// This barrel re-exports only the UI shell. Its implementation details remain
// private so the package can evolve without expanding its public contract.

export { default as CalcpadBlocksWorkbench } from './CalcpadBlocksWorkbench.vue';
