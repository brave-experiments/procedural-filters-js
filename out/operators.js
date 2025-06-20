import * as utils from './utils.js';
const W = window;
// Implementation of ":css-selector" rule
const operatorCssSelector = (selector, element) => {
    const trimmedSelector = selector.trimStart();
    if (trimmedSelector.startsWith('+')) {
        const subOperator = utils._stripCssOperator('+', trimmedSelector);
        if (subOperator === null) {
            return [];
        }
        const nextSibNode = utils._nextSiblingElement(element);
        if (nextSibNode === null) {
            return [];
        }
        return nextSibNode.matches(subOperator) ? [nextSibNode] : [];
    }
    else if (trimmedSelector.startsWith('~')) {
        const subOperator = utils._stripCssOperator('~', trimmedSelector);
        if (subOperator === null) {
            return [];
        }
        const allSiblingNodes = utils._allOtherSiblings(element);
        return allSiblingNodes.filter(x => x.matches(subOperator));
    }
    else if (trimmedSelector.startsWith('>')) {
        const subOperator = utils._stripCssOperator('>', trimmedSelector);
        if (subOperator === null) {
            return [];
        }
        const allChildNodes = utils._allChildren(element);
        return allChildNodes.filter(x => x.matches(subOperator));
    }
    else if (selector.startsWith(' ')) {
        return Array.from(element.querySelectorAll(':scope ' + trimmedSelector));
    }
    if (element.matches(selector)) {
        return [element];
    }
    return [];
};
// Implementation of ":has" rule
const operatorHas = (instruction, element) => {
    if (W.Array.isArray(instruction)) {
        return utils._hasProceduralSelectorCase(instruction, element);
    }
    else {
        return utils._hasPlainSelectorCase(instruction, element);
    }
};
// Implementation of ":has-text" rule
const operatorHasText = (instruction, element) => {
    const text = element.innerText;
    const valueTest = utils._extractValueMatchRuleFromStr(instruction);
    return valueTest(text) ? [element] : [];
};
// Implementation of ":not" rule
const operatorNot = (instruction, element) => {
    if (Array.isArray(instruction)) {
        return utils._notProceduralSelectorCase(instruction, element);
    }
    else {
        return utils._notPlainSelectorCase(instruction, element);
    }
};
// Implementation of ":matches-property" rule
const operatorMatchesProperty = (instruction, element) => {
    const [keyTest, valueTest] = utils._parseKeyValueMatchRules(instruction);
    for (const [propName, propValue] of Object.entries(element)) {
        if (!keyTest(propName)) {
            continue;
        }
        if (!valueTest(propValue)) {
            continue;
        }
        return [element];
    }
    return [];
};
// Implementation of ":min-text-length" rule
const operatorMinTextLength = (instruction, element) => {
    const minLength = +instruction;
    if (minLength === W.NaN) {
        throw new Error(`min-text-length: Invalid arg, ${instruction}`);
    }
    return element.innerText.trim().length >= minLength ? [element] : [];
};
// Implementation of ":matches-attr" rule
const operatorMatchesAttr = (instruction, element) => {
    const [keyTest, valueTest] = utils._parseKeyValueMatchRules(instruction);
    for (const attrName of element.getAttributeNames()) {
        if (!keyTest(attrName)) {
            continue;
        }
        const attrValue = element.getAttribute(attrName);
        if (attrValue === null || !valueTest(attrValue)) {
            continue;
        }
        return [element];
    }
    return [];
};
// Implementation of ":matches-css-*" rules
const operatorMatchesCSS = (beforeOrAfter, cssInstruction, element) => {
    const [cssKey, expectedVal] = utils._parseCSSInstruction(cssInstruction);
    const elmStyle = W.getComputedStyle(element, beforeOrAfter);
    const styleValue = elmStyle.getPropertyValue(cssKey);
    if (styleValue === undefined) {
        // We're querying for a style property that doesn't exist, which
        // trivially doesn't match then.
        return [];
    }
    return expectedVal === styleValue ? [element] : [];
};
// Implementation of ":matches-media" rule
const operatorMatchesMedia = (instruction, element) => {
    return W.matchMedia(instruction).matches ? [element] : [];
};
// Implementation of ":matches-path" rule
const operatorMatchesPath = (instruction, element) => {
    const pathAndQuery = W.location.pathname + W.location.search;
    const matchRule = utils._extractValueMatchRuleFromStr(instruction);
    return matchRule(pathAndQuery) ? [element] : [];
};
// Implementation of ":upward" rule
const operatorUpward = (instruction, element) => {
    if (W.Number.isInteger(+instruction)) {
        return utils._upwardIntCase(+instruction, element);
    }
    else if (W.Array.isArray(instruction)) {
        return utils._upwardProceduralSelectorCase(instruction, element);
    }
    else {
        return utils._upwardPlainSelectorCase(instruction, element);
    }
};
// Implementation of ":xpath" rule
const operatorXPath = (instruction, element) => {
    const result = W.document.evaluate(instruction, element, null, W.XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
    const matches = [];
    let currentNode;
    while ((currentNode = result.iterateNext())) {
        const currentElement = utils._asHTMLElement(currentNode);
        if (currentElement !== null) {
            matches.push(currentElement);
        }
    }
    return matches;
};
const ruleTypeToFuncMap = {
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
};
export { operatorCssSelector, operatorHas, operatorHasText, operatorNot, operatorMatchesProperty, operatorMinTextLength, operatorMatchesAttr, operatorMatchesCSS, operatorMatchesMedia, operatorMatchesPath, operatorUpward, operatorXPath, ruleTypeToFuncMap, };
