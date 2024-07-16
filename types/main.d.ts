declare const compileProceduralSelector: (operators: ProceduralSelector) => CompiledProceduralSelector;
declare const applyCompiledSelector: (selector: CompiledProceduralSelector, initNodes?: HTMLElement[]) => HTMLElement[];
declare const compileAndApplyProceduralSelector: (selector: ProceduralSelector, element: HTMLElement) => HTMLElement[];
export { applyCompiledSelector, compileProceduralSelector, compileAndApplyProceduralSelector, };
