const W = window

const _compileRegEx = (regexText) => {
  const regexParts = regexText.split('/')
  const regexPattern = regexParts[1]
  const regexArgs = regexParts[2]
  const regex = new W.RegExp(regexPattern, regexArgs)
  return regex
}

const _parseKeyValueMatchArg = (argStr) => {
  const rs = argStr.match(/"(.*)"="(.*)"/)
  if (!rs) {
    console.error(`${argStr} did not match regex /"(.*)"="(.*)"/`)
    return
  }
  return [rs[1], rs[2]]
}

// Check to see if the string `value` either
// contains the the string `test` (if `test` does
// not start with `/`) or if the string
// value matches the regex `test`.
// We assume if test isn't a string, its a regex object.
//
// If `exact` is true, then the string case it tested
// for an exact match (the regex case is not affected).
const testMatches = (test, value, exact = false) => {
  if (test[0] === '/') {
    return value.match(_compileRegEx(test)) !== null
  }
  if (exact === true) {
    return value === test
  }
  return value.includes(test)
}

// Implementation of "css-selector" rule
const proceduralOperatorCssSelector = (selector, element) => {
  const _stripOperator = (operator, selector) => {
    if (selector[0] !== operator) {
      console.error(`Expected to find ${operator} in initial position of "${selector}`)
      return null
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

// Implementation of ":contains" rule
const proceduralOperatorContains = (instruction, element) => {
  const text = element.innerText
  return testMatches(instruction, text) ? element : null
}

// Implementation of ":has-text" rule
const proceduralOperatorHasText = (instruction, element) => {
  if (instruction[0] === '/') {
    console.error(
      `Invalid argument for :has-text. Received ${instruction} but ` +
      ':has-text does not accept regex arguments.')
    return null
  }
  return proceduralOperatorContains(instruction, element)
}

// Implementation of ":matches-property" rule
const proceduralOperatorMatchesProperty = (instruction, element) => {
  const tests = _parseKeyValueMatchArg(instruction)
  if (tests === undefined) {
    return null
  }
  const [keyTest, valueTest] = tests

  for (const [propName, propValue] of Object.entries(element)) {
    if (testMatches(keyTest, propName) === false) {
      continue
    }
    if (testMatches(valueTest, propValue) === false) {
      continue
    }
    return element
  }
  return null
}

// Implementation of ":matches-attr" rule
const proceduralOperatorMatchesAttr = (instruction, element) => {
  const tests = _parseKeyValueMatchArg(instruction)
  if (tests === undefined) {
    return null
  }
  const [attrTest, valueTest] = tests

  for (const attrName of element.getAttributeNames()) {
    if (testMatches(attrTest, attrName) === false) {
      continue
    }
    const attrValue = element.getAttribute(attrName)
    if (testMatches(valueTest, attrValue) === false) {
      continue
    }
    return element
  }
  return null
}

// Implementation of ":matches-css-*" rules
const proceduralOperatorMatchesCSS = (cssInstruction, beforeOrAfter, element) => {
  const cssInstructionBits = cssInstruction.split(': ')
  const [cssKey, cssVal] = cssInstructionBits

  const elmStyle = W.getComputedStyle(element, beforeOrAfter)
  const styleValue = elmStyle[cssKey]
  if (styleValue === undefined) {
    // We're querying for a style property that doesn't exist, which
    // trivially doesn't match then.
    return null
  }

  return testMatches(cssVal, styleValue, true) ? element : null
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

// Implementation of ":nth-ancestor" rule
const proceduralOperatorNthAncestor = (instruction, element) => {
  let ancestorsLeft = +instruction
  let curNode = element
  while (curNode != null && ancestorsLeft > 0) {
    ancestorsLeft -= 1
    curNode = curNode.parentNode
  }
  return curNode
}

const buildProceduralFilter = (ruleList) => {
  const operatorList = []
  for (const rule of ruleList) {
    let anOperatorFunc, args

    switch (rule.type) {
      case 'css-selector':
        args = [rule.selector]
        anOperatorFunc = proceduralOperatorCssSelector
        break
      case 'contains':
        args = [rule.arg]
        anOperatorFunc = proceduralOperatorContains
        break
      case 'has-text':
        args = [rule.text]
        anOperatorFunc = proceduralOperatorHasText
        break
      case 'matches-property':
        args = [rule.arg]
        anOperatorFunc = proceduralOperatorMatchesProperty
        break
      case 'matches-attr':
        args = [rule.arg]
        anOperatorFunc = proceduralOperatorMatchesAttr
        break
      case 'matches-css':
        args = [rule.arg, null]
        anOperatorFunc = proceduralOperatorMatchesCSS
        break
      case 'matches-css-after':
        args = [rule.arg, '::after']
        anOperatorFunc = proceduralOperatorMatchesCSS
        break
      case 'matches-css-before':
        args = [rule.arg, '::before']
        anOperatorFunc = proceduralOperatorMatchesCSS
        break
      case 'upward':
        args = [rule.arg]
        anOperatorFunc = proceduralOperatorUpward
        break
      case 'nth-ancestor':
        args = [rule.arg]
        anOperatorFunc = proceduralOperatorNthAncestor
        break
      default:
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
