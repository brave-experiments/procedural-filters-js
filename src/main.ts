const W = window

import { ruleTypeToFuncMap, operatorXPath } from './operators.js'
import { _asHTMLElement } from './utils.js'

const compileProceduralSelector = (operators: ProceduralSelector): CompiledProceduralSelector => {
  const outputOperatorList = []
  for (const operator of operators) {
    const anOperatorFunc = ruleTypeToFuncMap[operator.type]
    const args = [operator.arg]
    if (anOperatorFunc === undefined) {
      throw new Error(`Not sure what to do with operator of type ${operator.type}`)
    }

    outputOperatorList.push({
      type: operator.type,
      func: anOperatorFunc.bind(undefined, ...args),
      args,
    })
  }

  return outputOperatorList
}

// List of operator types that will be either globally true or false
// independent of the passed element. We use this list to optimize
// applying each operator (i.e., we just check the first element, and then
// accept or reject all elements in the consideration set accordingly).
const fastPathOperatorTypes: OperatorType[] = [
  'matches-media',
  'matches-path',
]

const _determineInitNodesAndIndex = (selector: CompiledProceduralSelector,
                                     initNodes?: HTMLElement[]): [number, HTMLElement[]] => {
  let nodesToConsider: HTMLElement[] = []
  let index = 0

  // A couple of special cases to consider.
  //
  // Case one: we're applying the procedural filter on a set of nodes (instead
  // of the entire document)  In this case, we already know which nodes to
  // consider, easy case.
  const firstOperator = selector[0]
  const firstOperatorType = firstOperator.type
  const firstArg = firstOperator.args[0]

  if (initNodes !== undefined) {
    nodesToConsider = W.Array.from(initNodes)
  }
  else if (firstOperatorType === 'css-selector') {
    const selector = firstArg as CSSSelector
    // Case two: we're considering the entire document, and the first operator
    // is a 'css-selector'. Here, we just special case using querySelectorAll
    // instead of starting with the full set of possible nodes.
    nodesToConsider = W.Array.from(W.document.querySelectorAll(selector))
    index += 1
  }
  else if (firstOperatorType === 'xpath') {
    const xpath = firstArg as string
    nodesToConsider = operatorXPath(xpath, W.document.documentElement)
    index += 1
  }
  else {
    // Case three: we gotta apply the first operator to the entire document.
    // Yuck but un-avoidable.
    const allNodes = W.Array.from(W.document.all)
    nodesToConsider = allNodes.filter(_asHTMLElement) as HTMLElement[]
  }
  return [index, nodesToConsider]
}

const applyCompiledSelector = (selector: CompiledProceduralSelector,
                               initNodes?: HTMLElement[]): HTMLElement[] => {
  const initState = _determineInitNodesAndIndex(selector, initNodes)
  let [index, nodesToConsider] = initState

  const numOperators = selector.length
  for (index; nodesToConsider.length > 0 && index < numOperators; ++index) {
    const operator = selector[index]
    const operatorFunc = operator.func
    const operatorType = operator.type

    // Note that we special case the :matches-path case here, since if
    // if it passes for one element, then it will pass for all elements.
    if (fastPathOperatorTypes.includes(operatorType)) {
      const firstNode = nodesToConsider[0]
      if (operatorFunc(firstNode).length === 0) {
        nodesToConsider = []
      }
      // Note that unless we've taken the if-true branch above, then
      // the nodesToConsider array will still have all the elements
      // it started with.
      break
    }

    let newNodesToConsider: HTMLElement[] = []
    for (const aNode of nodesToConsider) {
      const result = operatorFunc(aNode)
      newNodesToConsider = newNodesToConsider.concat(result)
    }
    nodesToConsider = newNodesToConsider
  }

  return nodesToConsider
}

const compileAndApplyProceduralSelector = (selector: ProceduralSelector,
                                           initElements: HTMLElement[]): HTMLElement[] => {
  const compiled = compileProceduralSelector(selector)
  return applyCompiledSelector(compiled, initElements)
}

export {
  applyCompiledSelector,
  compileProceduralSelector,
  compileAndApplyProceduralSelector,
}
