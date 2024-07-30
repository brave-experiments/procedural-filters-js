declare const compileProceduralSelector: (operators: ProceduralSelector) => CompiledProceduralSelector;
declare const applyCompiledSelector: (selector: CompiledProceduralSelector, initNodes?: HTMLElement[]) => HTMLElement[];
declare const compileAndApplyProceduralSelector: (selector: ProceduralSelector, initElements: HTMLElement[]) => HTMLElement[];
export { applyCompiledSelector, compileProceduralSelector, compileAndApplyProceduralSelector, };
