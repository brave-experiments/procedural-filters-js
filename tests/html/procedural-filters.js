const W = window

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

// Implementation of ":has-text" rule
const proceduralOperatorHasText = (instruction, element) => {
  const text = element.innerText
  const valueTest = _extractValueMatchRuleFromStr(instruction)
  return valueTest(text) ? element : null
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

// Implementation of "upward" rule
const proceduralOperatorUpward = (instruction, element) => {
  const _upwardInt = (intNeedle, element) => {
    let currentElement = element
    while (currentElement !== null && intNeedle > 0) {
      currentElement = currentElement.parentNode
      intNeedle -= 1
    }
    return currentElement
  }

  const _upwardSelector = (selector, element) => {
    let currentElement = element
    while (currentElement !== null) {
      if (currentElement.matches(selector)) {
        return currentElement
      }
      currentElement = currentElement.parentNode
    }
    return null
  }

  if (W.Number.isInteger(+instruction)) {
    return _upwardInt(instruction, element)
  }
  return _upwardSelector(instruction, element)
}

const proceduralOperatorChildren = (ruleList, element) => {
  const childRuleList = buildProceduralFilter(ruleList)
  const matches = getNodesMatchingFilter(childRuleList, [element])
  return matches.length === 0 ? null : element
}

const ruleTypeToFuncMap = {
  'css-selector': proceduralOperatorCssSelector,
  'has-text': proceduralOperatorHasText,
  'matches-attr': proceduralOperatorMatchesAttr,
  'matches-css': proceduralOperatorMatchesCSS.bind(undefined, null),
  'matches-css-after': proceduralOperatorMatchesCSS.bind(undefined, '::after'),
  'matches-css-before': proceduralOperatorMatchesCSS.bind(undefined, '::before'),
  'matches-property': proceduralOperatorMatchesProperty,
  children: proceduralOperatorChildren,
  contains: proceduralOperatorHasText,
  upward: proceduralOperatorUpward
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

const getNodesMatchingFilter = (filter, initNodes = undefined) => {
  let nodesToConsider = []
  let operatorIndex = 0

  // A couple of special cases to consider.
  //
  // Case one: we're applying the procedural filter on a set of nodes (instead
  // of the entire document)  In this case, we already know which nodes to
  // consider, easy case.
  if (initNodes !== undefined) {
    nodesToConsider = W.Array.from(initNodes)
  } else if (filter[0].type === 'css-selector') {
    // Case two: we're considering the entire document, and the first operator
    // is a 'css-selector'. Here, we just special case using querySelectorAll
    // instead of starting with the full set of possible nodes.
    const initialSelector = filter[0].args[0]
    nodesToConsider = W.Array.from(W.document.querySelectorAll(initialSelector))
    operatorIndex += 1
  } else {
    // Case three: we gotta apply the first operator to the entire document.
    // Yuck but un-avoidable.
    nodesToConsider = W.Array.from(W.document.all)
  }

  const numOperators = filter.length
  for (operatorIndex; operatorIndex < numOperators; ++operatorIndex) {
    const operatorFunc = filter[operatorIndex].func
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
