const W = window

const _isDocument = (element) => {
  const documentProto = W.HTMLDocument.prototype
  return W.Object.getPrototypeOf(element) === documentProto
}

const _compileRegEx = (regexText) => {
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
const _testMatches = (test, value, exact = false) => {
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

const _extractKeyMatchRuleFromStr = (text) => {
  const quotedTerminator = '"='
  const unquotedTerminator = '='
  const isQuotedCase = text[0] === '"'

  const [terminator, needlePosition] = isQuotedCase
    ? [quotedTerminator, 1]
    : [unquotedTerminator, 0]

  const indexOfTerminator = text.indexOf(terminator, needlePosition)
  if (indexOfTerminator === -1) {
    throw new Error(
      `Unable to parse key rule from ${text}. Key rule starts with ` +
      `${text[0]}, but doesn't include '${terminator}'`)
  }

  const testCaseStr = text.slice(needlePosition, indexOfTerminator)
  const testCaseFunc = _testMatches.bind(undefined, testCaseStr)
  const finalNeedlePosition = indexOfTerminator + terminator.length
  return [testCaseFunc, finalNeedlePosition]
}

const _extractValueMatchRuleFromStr = (text, needlePosition = 0) => {
  const isQuotedCase = text[needlePosition] === '"'
  let endIndex

  if (isQuotedCase) {
    if (text.at(-1) !== '"') {
      throw new Error(
        `Unable to parse value rule from ${text}. Value rule starts with ` +
        '" but doesn\'t end with "')
    }
    needlePosition += 1
    endIndex = text.length - 1
  } else {
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
const _parseKeyValueMatchRules = (argStr) => {
  const [keyMatchRule, needlePos] = _extractKeyMatchRuleFromStr(argStr)
  const valueMatchRule = _extractValueMatchRuleFromStr(argStr, needlePos)
  return [keyMatchRule, valueMatchRule]
}

// Implementation of "css-selector" rule
const proceduralOperatorCssSelector = (selector, element) => {
  const _stripOperator = (operator, selector) => {
    if (selector[0] !== operator) {
      throw new Error(
        `Expected to find ${operator} in initial position of "${selector}`)
    }
    return selector.replace(operator, '').trimStart()
  }

  const _nextSibling = (element) => {
    const siblings = W.Array.from(element.parentNode.children)
    const indexOfElm = siblings.indexOf(element)
    return siblings[indexOfElm + 1]
  }

  const _allSiblings = (element) => {
    const siblings = Array.from(element.parentNode.children)
    return siblings.filter(x => x !== element)
  }

  const trimmedSelector = selector.trimStart()
  if (trimmedSelector.startsWith('+') === true) {
    const subOperator = _stripOperator('+', trimmedSelector)
    if (subOperator === null) {
      return null
    }
    const nextSibNode = _nextSibling(element)
    if (nextSibNode === undefined) {
      return null
    }
    return nextSibNode.matches(subOperator) ? nextSibNode : null
  }

  if (trimmedSelector.startsWith('~') === true) {
    const subOperator = _stripOperator('~', trimmedSelector)
    if (subOperator === null) {
      return null
    }
    const allSiblingNodes = _allSiblings(element)
    return allSiblingNodes.filter(x => x.matches(subOperator))
  }

  return Array.from(element.querySelectorAll(':scope ' + trimmedSelector))
}

const _hasSelectorCase = (selector, element) => {
  return element.matches(selector) ? element : null
}

const _hasChildFiltersCase = (childFilters, element) => {
  const matches = _elementsMatchingRuleList(childFilters, element)
  return matches.length === 0 ? null : element
}

const proceduralOperatorHas = (instruction, element) => {
  if (W.Array.isArray(instruction)) {
    return _hasChildFiltersCase(instruction, element)
  } else {
    return _hasSelectorCase(instruction, element)
  }
}

// Implementation of ":has-text" rule
const proceduralOperatorHasText = (instruction, element) => {
  const text = element.innerText
  const valueTest = _extractValueMatchRuleFromStr(instruction)
  return valueTest(text) ? element : null
}

const _notSelectorCase = (selector, element) => {
  return element.matches(selector) ? null : selector
}

const _notChildFiltersCase = (childFilters, element) => {
  const matches = _elementsMatchingRuleList(childFilters, element)
  return matches.length === 0 ? element : null
}

const proceduralOperatorNot = (instruction, element) => {
  if (Array.isArray(instruction)) {
    return _notChildFiltersCase(instruction, element)
  } else {
    return _notSelectorCase(instruction, element)
  }
}

// Implementation of ":matches-property" rule
const proceduralOperatorMatchesProperty = (instruction, element) => {
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
const proceduralOperatorMinTextLength = (instruction, element) => {
  const minLength = +instruction
  if (minLength === W.NaN) {
    throw new Error(`Invalid arg for min-text-length: ${instruction}`)
  }
  return element.innerText.trim().length >= minLength ? element : null
}

// Implementation of ":matches-attr" rule
const proceduralOperatorMatchesAttr = (instruction, element) => {
  const [keyTest, valueTest] = _parseKeyValueMatchRules(instruction)
  for (const attrName of element.getAttributeNames()) {
    if (keyTest(attrName) === false) {
      continue
    }
    const attrValue = element.getAttribute(attrName)
    if (valueTest(attrValue) === false) {
      continue
    }
    return element
  }
  return null
}

// Implementation of ":matches-css-*" rules
const proceduralOperatorMatchesCSS = (beforeOrAfter, cssInstruction, element) => {
  const cssInstructionBits = cssInstruction.split(': ')
  const [cssKey, cssVal] = cssInstructionBits
  const valueTest = _extractValueMatchRuleFromStr(cssVal)
  const elmStyle = W.getComputedStyle(element, beforeOrAfter)
  const styleValue = elmStyle[cssKey]
  if (styleValue === undefined) {
    // We're querying for a style property that doesn't exist, which
    // trivially doesn't match then.
    return null
  }
  return valueTest(styleValue, true) ? element : null
}

// Implementation of ":matches-media" rule
const proceduralOperatorMatchesMedia = (instruction, element) => {
  return W.matchMedia(instruction).matches === true
    ? element
    : null
}

// Implementation of ":matches-path" rule
const proceduralOperatorMatchesPath = (instruction, element) => {
  const pathAndQuery = W.location.pathname + W.location.search
  const matchRule = _extractValueMatchRuleFromStr(instruction)
  return matchRule(pathAndQuery) ? element : null
}

const _upwardIntCase = (intNeedle, element) => {
  let currentElement = element
  while (currentElement !== null && intNeedle > 0) {
    currentElement = currentElement.parentNode
    intNeedle -= 1
  }
  return currentElement
}

const _upwardChildFiltersCase = (childFilters, element) => {
  const childRuleList = buildProceduralFilter(childFilters)
  let currentElement = element
  while (currentElement !== null && _isDocument(currentElement) === false) {
    const matches = getNodesMatchingFilter(childRuleList, [currentElement])
    if (matches.length !== 0) {
      return currentElement
    }
    currentElement = currentElement.parentNode
  }
  return null
}

const _upwardSelectorCase = (selector, element) => {
  let currentElement = element
  while (currentElement !== null && _isDocument(currentElement) === false) {
    if (currentElement.matches(selector)) {
      return currentElement
    }
    currentElement = currentElement.parentNode
  }
  return null
}

// Implementation of ":upward" rule
const proceduralOperatorUpward = (instruction, element) => {
  if (W.Number.isInteger(+instruction)) {
    return _upwardIntCase(instruction, element)
  } else if (W.Array.isArray(instruction)) {
    return _upwardChildFiltersCase(instruction, element)
  } else {
    // Assume selector case
    return _upwardSelectorCase(instruction, element)
  }
}

// Implementation of ":xpath" rule
const proceduralOperatorXPath = (instruction, element) => {
  const result = W.document.evaluate(instruction, element, null,
    W.XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null)
  const nodes = []
  let currentNode
  while ((currentNode = result.iterateNext())) {
    nodes.push(currentNode)
  }
  return nodes
}

// Not yet implemented
//  - other
//  - watch-attr

const ruleTypeToFuncMap = {
  contains: proceduralOperatorHasText,
  'css-selector': proceduralOperatorCssSelector,
  has: proceduralOperatorHas,
  'has-text': proceduralOperatorHasText,
  'matches-attr': proceduralOperatorMatchesAttr,
  'matches-css': proceduralOperatorMatchesCSS.bind(undefined, null),
  'matches-css-after': proceduralOperatorMatchesCSS.bind(undefined, '::after'),
  'matches-css-before': proceduralOperatorMatchesCSS.bind(undefined, '::before'),
  'matches-media': proceduralOperatorMatchesMedia,
  'matches-path': proceduralOperatorMatchesPath,
  'matches-property': proceduralOperatorMatchesProperty,
  'min-text-length': proceduralOperatorMinTextLength,
  not: proceduralOperatorNot,
  upward: proceduralOperatorUpward,
  xpath: proceduralOperatorXPath
}

const _elementsMatchingRuleList = (ruleList, element) => {
  const childRuleList = buildProceduralFilter(ruleList)
  return getNodesMatchingFilter(childRuleList, [element])
}

const buildProceduralFilter = (ruleList) => {
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
      args
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
  'matches-path'
]

const getNodesMatchingFilter = (filter, initNodes = undefined) => {
  let nodesToConsider = []
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
  } else if (firstOperatorType === 'css-selector') {
    // Case two: we're considering the entire document, and the first operator
    // is a 'css-selector'. Here, we just special case using querySelectorAll
    // instead of starting with the full set of possible nodes.
    nodesToConsider = W.Array.from(W.document.querySelectorAll(firstArg))
    index += 1
  } else if (firstOperatorType === 'xpath') {
    nodesToConsider = proceduralOperatorXPath(firstArg, W.document)
    index += 1
  } else {
    // Case three: we gotta apply the first operator to the entire document.
    // Yuck but un-avoidable.
    nodesToConsider = W.Array.from(W.document.all)
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

    let newNodesToConsider = []
    for (const aNode of nodesToConsider) {
      const result = operatorFunc(aNode)
      if (result === null) {
        continue
      } else if (Array.isArray(result)) {
        newNodesToConsider = newNodesToConsider.concat(result)
      } else {
        newNodesToConsider.push(result)
      }
    }
    nodesToConsider = newNodesToConsider
  }

  return nodesToConsider
}

const hideOnlyCurMatchingNodes = (nodesToHideSet, prevNodesMap) => {
  // First, see if there are any nodes we'd hidden previously
  // that no longer match the procedural filters. If there are,
  // then restore their style to what it was before we hid them,
  for (const aNode of prevNodesMap.keys()) {
    if (nodesToHideSet.has(aNode) === false) {
      aNode.style.display = prevNodesMap[aNode]
    }
  }

  const currentNodesMap = new Map()
  // Now, hide any currently matching nodes that are not already hidden.
  for (const aNode of nodesToHideSet) {
    // Handle the case where a previously matching node is still matching.
    // In this case, we just continue to copy over the node's pre-being-hidden
    // inline style (if any), and make sure the node is still hidden.
    if (prevNodesMap.has(aNode) === true) {
      currentNodesMap[aNode] = prevNodesMap[aNode]
    } else {
      currentNodesMap[aNode] = aNode.style.display
    }
    aNode.style.display = 'none'
  }
  return currentNodesMap
}

export const run = (ruleList, pollingInterval = 0) => {
  const filter = buildProceduralFilter(ruleList)

  let prevNodes = new Map()
  let matchingNodes = new Set(getNodesMatchingFilter(filter))
  prevNodes = hideOnlyCurMatchingNodes(matchingNodes, prevNodes)

  if (pollingInterval === 0) {
    return
  }

  const intervalId = W.setInterval(() => {
    matchingNodes = getNodesMatchingFilter(filter)
    prevNodes = hideOnlyCurMatchingNodes(matchingNodes, prevNodes)
  }, pollingInterval)

  return () => {
    W.clearInterval(intervalId)
  }
}
