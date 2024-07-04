const W = window

const _asHTMLElement = (node: Node): HTMLElement | null => {
  return (node instanceof HTMLElement) ? node as HTMLElement : null
}

const _compileRegEx = (regexText: string): RegExp => {
  const regexParts = regexText.split('/')
  const regexPattern = regexParts[1]
  const regexArgs = regexParts[2]
  const regex = new W.RegExp(regexPattern, regexArgs)
  return regex
}

// Check to see if the string `value` either
// contains the the string `test` (if `test` does
// not start with `/`) or if the string
// value matches the regex `test`.
// We assume if test isn't a string, its a regex object.
//
// Rules:
//   - if `test` starts with `/` we treat it as a regex
//     literal
//   - if `text` is an empty string, we treat it as
//     matching any case where value is only whitespace
//   - otherwise, check to see if value contains the
//     string `test`
//
// If `exact` is true, then the string case it tested
// for an exact match (the regex case is not affected).
const _testMatches = (test: string, value: string, exact = false): boolean => {
  if (test[0] === '/') {
    return value.match(_compileRegEx(test)) !== null
  }
  if (test === '') {
    return value.trim() === ''
  }
  if (exact === true) {
    return value === test
  }
  return value.includes(test)
}

const _extractKeyMatchRuleFromStr = (text: string): [TextMatchRule, number] => {
  const quotedTerminator = '"='
  const unquotedTerminator = '='
  const isQuotedCase = text[0] === '"'

  const [terminator, needlePosition] = isQuotedCase
    ? [quotedTerminator, 1]
    : [unquotedTerminator, 0]

  const indexOfTerminator = text.indexOf(terminator, needlePosition)
  if (indexOfTerminator === -1) {
    throw new Error(
      `Unable to parse key rule from ${text}. Key rule starts with `
      + `${text[0]}, but doesn't include '${terminator}'`)
  }

  const testCaseStr = text.slice(needlePosition, indexOfTerminator)
  const testCaseFunc = _testMatches.bind(undefined, testCaseStr)
  const finalNeedlePosition = indexOfTerminator + terminator.length
  return [testCaseFunc, finalNeedlePosition]
}

const _extractValueMatchRuleFromStr = (text: string,
                                       needlePosition = 0): TextMatchRule => {
  const isQuotedCase = text[needlePosition] === '"'
  let endIndex

  if (isQuotedCase) {
    if (text.at(-1) !== '"') {
      throw new Error(
        `Unable to parse value rule from ${text}. Value rule starts with `
        + '" but doesn\'t end with "')
    }
    needlePosition += 1
    endIndex = text.length - 1
  }
  else {
    endIndex = text.length
  }

  const testCaseStr = text.slice(needlePosition, endIndex)
  const testCaseFunc = _testMatches.bind(undefined, testCaseStr)
  return testCaseFunc
}

// Parse an argument like `"abc"="xyz"` into
// a test for the key, and a test for the value.
// This will return two functions then, that you
// should use for checking the key and values
// in your test case.
//
// const key = ..., value = ...
// const [keyTestFunc, valueTestFunc] = _parseKeyValueMatchArg(arg)
//
// if (keyTestFunc(key) === true)) {
//   // key matches the test condition
// }
const _parseKeyValueMatchRules = (arg: string): KeyValueMatchRules => {
  const [keyMatchRule, needlePos] = _extractKeyMatchRuleFromStr(arg)
  const valueMatchRule = _extractValueMatchRuleFromStr(arg, needlePos)
  return [keyMatchRule, valueMatchRule]
}

const _parseCSSInstruction = (arg: string): [CSSInstruction, CSSValue] => {
  const rs = arg.split(':')
  if (rs.length !== 2) {
    throw Error(`Unexpected format for a CSS rule: ${arg}`)
  }
  return [rs[0].trim(), rs[1].trim()]
}

const _allOtherSiblings = (element: HTMLElement): HTMLElement[] => {
  if (!element.parentNode) {
    return []
  }
  const siblings = Array.from(element.parentNode.children)
  const otherHTMLElements = []
  for (const sib of siblings) {
    if (sib === element) {
      continue
    }
    const siblingHTMLElement = _asHTMLElement(sib)
    if (siblingHTMLElement !== null) {
      otherHTMLElements.push(siblingHTMLElement)
    }
  }
  return otherHTMLElements
}

const _nextSiblingElement = (element: HTMLElement): HTMLElement | null => {
  if (!element.parentNode) {
    return null
  }
  const siblings = W.Array.from(element.parentNode.children)
  const indexOfElm = siblings.indexOf(element)
  const nextSibling = siblings[indexOfElm + 1]
  if (nextSibling === undefined) {
    return null
  }
  return _asHTMLElement(nextSibling)
}

// Implementation of ":css-selector" rule
const operatorCssSelector = (selector: CSSSelector,
                             element: HTMLElement): OperatorResult => {
  const _stripOperator = (operator: string, selector: string) => {
    if (selector[0] !== operator) {
      throw new Error(
        `Expected to find ${operator} in initial position of "${selector}`)
    }
    return selector.replace(operator, '').trimStart()
  }

  const trimmedSelector = selector.trimStart()
  if (trimmedSelector.startsWith('+') === true) {
    const subOperator = _stripOperator('+', trimmedSelector)
    if (subOperator === null) {
      return null
    }
    const nextSibNode = _nextSiblingElement(element)
    if (nextSibNode === null) {
      return null
    }
    return nextSibNode.matches(subOperator) ? nextSibNode : null
  }

  if (trimmedSelector.startsWith('~') === true) {
    const subOperator = _stripOperator('~', trimmedSelector)
    if (subOperator === null) {
      return null
    }
    const allSiblingNodes = _allOtherSiblings(element)
    return allSiblingNodes.filter(x => x.matches(subOperator))
  }

  return Array.from(element.querySelectorAll(':scope ' + trimmedSelector))
}

const _hasSelectorCase = (selector: CSSSelector,
                          element: HTMLElement): OperatorResult => {
  return element.matches(selector) ? element : null
}

const _hasChildRulesCase = (childRules: Rule[],
                            element: HTMLElement): OperatorResult => {
  const matches = buildAndApplyFilter(childRules, element)
  return matches.length === 0 ? null : element
}

// Implementation of ":has" rule
const operatorHas = (instruction: CSSSelector | Rule[],
                     element: HTMLElement): OperatorResult => {
  if (W.Array.isArray(instruction)) {
    return _hasChildRulesCase(instruction, element)
  }
  else {
    return _hasSelectorCase(instruction, element)
  }
}

// Implementation of ":has-text" rule
const operatorHasText = (instruction: string,
                         element: HTMLElement): OperatorResult => {
  const text = element.innerText
  const valueTest = _extractValueMatchRuleFromStr(instruction)
  return valueTest(text) ? element : null
}

const _notSelectorCase = (selector: CSSSelector,
                          element: HTMLElement): OperatorResult => {
  return element.matches(selector) ? null : element
}

const _notChildRulesCase = (childRules: Rule[],
                            element: HTMLElement): OperatorResult => {
  const matches = buildAndApplyFilter(childRules, element)
  return matches.length === 0 ? element : null
}

// Implementation of ":not" rule
const operatorNot = (instruction: CSSSelector | Rule[],
                     element: HTMLElement): OperatorResult => {
  if (Array.isArray(instruction)) {
    return _notChildRulesCase(instruction, element)
  }
  else {
    return _notSelectorCase(instruction, element)
  }
}

// Implementation of ":matches-property" rule
const operatorMatchesProperty = (instruction: string,
                                 element: HTMLElement): OperatorResult => {
  const [keyTest, valueTest] = _parseKeyValueMatchRules(instruction)
  for (const [propName, propValue] of Object.entries(element)) {
    if (keyTest(propName) === false) {
      continue
    }
    if (valueTest(propValue) === false) {
      continue
    }
    return element
  }
  return null
}

// Implementation of ":min-text-length" rule
const operatorMinTextLength = (instruction: string,
                               element: HTMLElement): OperatorResult => {
  const minLength = +instruction
  if (minLength === W.NaN) {
    throw new Error(`min-text-length: Invalid arg, ${instruction}`)
  }
  return element.innerText.trim().length >= minLength ? element : null
}

// Implementation of ":matches-attr" rule
const operatorMatchesAttr = (instruction: string,
                             element: HTMLElement): OperatorResult => {
  const [keyTest, valueTest] = _parseKeyValueMatchRules(instruction)
  for (const attrName of element.getAttributeNames()) {
    if (keyTest(attrName) === false) {
      continue
    }
    const attrValue = element.getAttribute(attrName)
    if (attrValue === null || valueTest(attrValue) === false) {
      continue
    }
    return element
  }
  return null
}

// Implementation of ":matches-css-*" rules
const operatorMatchesCSS = (beforeOrAfter: string | null,
                            cssInstruction: string,
                            element: HTMLElement): OperatorResult => {
  const [cssKey, expectedVal] = _parseCSSInstruction(cssInstruction)
  const elmStyle = W.getComputedStyle(element, beforeOrAfter)
  const styleValue = elmStyle.getPropertyValue(cssKey)
  if (styleValue === undefined) {
    // We're querying for a style property that doesn't exist, which
    // trivially doesn't match then.
    return null
  }
  return expectedVal === styleValue ? element : null
}

// Implementation of ":matches-media" rule
const operatorMatchesMedia = (instruction: string,
                              element: HTMLElement): OperatorResult => {
  return W.matchMedia(instruction).matches === true ? element : null
}

// Implementation of ":matches-path" rule
const operatorMatchesPath = (instruction: string,
                             element: HTMLElement): OperatorResult => {
  const pathAndQuery = W.location.pathname + W.location.search
  const matchRule = _extractValueMatchRuleFromStr(instruction)
  return matchRule(pathAndQuery) ? element : null
}

const _upwardIntCase = (intNeedle: NeedlePosition,
                        element: HTMLElement): OperatorResult => {
  if (intNeedle < 1 || intNeedle >= 256) {
    throw new Error(`upward: invalid arg, ${intNeedle}`)
  }
  let currentElement: HTMLElement | ParentNode | null = element
  while (currentElement !== null && intNeedle > 0) {
    currentElement = currentElement.parentNode
    intNeedle -= 1
  }
  return (currentElement === null) ? null : _asHTMLElement(currentElement)
}

const _upwardChildRulesCase = (childRules: Rule[],
                               element: HTMLElement): OperatorResult => {
  const childFilter = buildFilter(childRules)
  let needle: ParentNode | HTMLElement | null = element
  while (needle !== null) {
    const currentElement = _asHTMLElement(needle)
    if (currentElement === null) {
      break
    }
    const matches = applyFilter(childFilter, [currentElement])
    if (matches.length !== 0) {
      return currentElement
    }
    needle = currentElement.parentNode
  }
  return null
}

const _upwardSelectorCase = (selector: CSSSelector,
                             element: HTMLElement): OperatorResult => {
  let needle: ParentNode | HTMLDocument | null = element
  while (needle !== null) {
    const currentElement = _asHTMLElement(needle)
    if (currentElement === null) {
      break
    }
    if (currentElement.matches(selector)) {
      return currentElement
    }
    needle = currentElement.parentNode
  }
  return null
}

// Implementation of ":upward" rule
const operatorUpward = (instruction: string | Rule[],
                        element: HTMLElement): OperatorResult => {
  if (W.Number.isInteger(+instruction)) {
    return _upwardIntCase(+instruction, element)
  }
  else if (W.Array.isArray(instruction)) {
    return _upwardChildRulesCase(instruction, element)
  }
  else {
    // Assume selector case
    return _upwardSelectorCase(instruction, element)
  }
}

// Implementation of ":xpath" rule
const operatorXPath = (instruction: string,
                       element: HTMLElement): HTMLElement[] => {
  const result = W.document.evaluate(instruction, element, null,
                                     W.XPathResult.UNORDERED_NODE_ITERATOR_TYPE,
                                     null)
  const matches: HTMLElement[] = []
  let currentNode: Node | null
  while ((currentNode = result.iterateNext())) {
    const currentElement = _asHTMLElement(currentNode)
    if (currentElement !== null) {
      matches.push(currentElement)
    }
  }
  return matches
}

const ruleTypeToFuncMap: Record<OperatorType, UnboundOperatorFunc> = {
  'contains': operatorHasText,
  'css-selector': operatorCssSelector,
  'has': operatorHas,
  'has-text': operatorHasText,
  'matches-attr': operatorMatchesAttr,
  'matches-css': operatorMatchesCSS.bind(undefined, null),
  'matches-css-after': operatorMatchesCSS.bind(undefined, '::after'),
  'matches-css-before': operatorMatchesCSS.bind(undefined, '::before'),
  'matches-media': operatorMatchesMedia,
  'matches-path': operatorMatchesPath,
  'matches-property': operatorMatchesProperty,
  'min-text-length': operatorMinTextLength,
  'not': operatorNot,
  'upward': operatorUpward,
  'xpath': operatorXPath,
}

export const buildFilter = (ruleList: Rule[]): Filter => {
  const operatorList = []
  for (const rule of ruleList) {
    const anOperatorFunc = ruleTypeToFuncMap[rule.type]
    const args = [rule.arg]
    if (anOperatorFunc === undefined) {
      throw new Error(`Not sure what to do with rule of type ${rule.type}`)
    }

    operatorList.push({
      type: rule.type,
      func: anOperatorFunc.bind(undefined, ...args),
      args,
    })
  }

  return operatorList
}

// List of operator types that will be either globally true or false
// independent of the passed element. We use this list to optimize
// applying each operator (i.e., we just check the first element, and then
// accept or reject all elements in the consideration set accordingly).
const fastPathOperatorTypes = [
  'matches-media',
  'matches-path',
]

export const applyFilter = (filter: Filter,
                            initNodes?: HTMLElement[]): HTMLElement[] => {
  let nodesToConsider: HTMLElement[] = []
  let index = 0

  // A couple of special cases to consider.
  //
  // Case one: we're applying the procedural filter on a set of nodes (instead
  // of the entire document)  In this case, we already know which nodes to
  // consider, easy case.
  const firstOperator = filter[0]
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

  const numOperators = filter.length
  for (index; nodesToConsider.length > 0 && index < numOperators; ++index) {
    const operator = filter[index]
    const operatorFunc = operator.func
    const operatorType = operator.type

    // Note that we special case the :matches-path case here, since if
    // if it passes for one element, then it will pass for all elements.
    if (fastPathOperatorTypes.includes(operatorType)) {
      const firstNode = nodesToConsider[0]
      if (operatorFunc(firstNode) === null) {
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
      if (result === null) {
        continue
      }
      else if (Array.isArray(result)) {
        newNodesToConsider = newNodesToConsider.concat(result)
      }
      else {
        newNodesToConsider.push(result)
      }
    }
    nodesToConsider = newNodesToConsider
  }

  return nodesToConsider
}

export const buildAndApplyFilter = (ruleList: Rule[],
                                    element: HTMLElement): HTMLElement[] => {
  const filter = buildFilter(ruleList)
  return applyFilter(filter, [element])
}