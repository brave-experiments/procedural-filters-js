import { compileProceduralSelector, applyCompiledSelector } from './procedural-filters.js'

const W = window

const hideOnlyCurMatchingNodes = (nodesToHideSet, prevNodesMap) => {
  // First, see if there are any nodes we'd hidden previously
  // that no longer match the procedural filters. If there are,
  // then restore their style to what it was before we hid them,
  for (const aNode of prevNodesMap.keys()) {
    if (nodesToHideSet.has(aNode) === false) {
      aNode.style.display = prevNodesMap[aNode]
    }
  }

  const currentNodesMap = new W.Map()
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
  const filter = compileProceduralSelector(ruleList)

  let prevNodes = new Map()
  let matchingNodes = new W.Set(applyCompiledSelector(filter))
  prevNodes = hideOnlyCurMatchingNodes(matchingNodes, prevNodes)

  if (pollingInterval === 0) {
    return
  }

  const intervalId = W.setInterval(() => {
    matchingNodes = applyCompiledSelector(filter)
    prevNodes = hideOnlyCurMatchingNodes(matchingNodes, prevNodes)
  }, pollingInterval)

  return () => {
    W.clearInterval(intervalId)
  }
}
