import * as main from './main.js';
const W = window;
const _asHTMLElement = (node) => {
    return (node instanceof HTMLElement) ? node : null;
};
const _compileRegEx = (regexText) => {
    const regexParts = regexText.split('/');
    const regexPattern = regexParts[1];
    const regexArgs = regexParts[2];
    const regex = new W.RegExp(regexPattern, regexArgs);
    return regex;
};
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
        return value.match(_compileRegEx(test)) !== null;
    }
    if (test === '') {
        return value.trim() === '';
    }
    if (exact) {
        return value === test;
    }
    return value.includes(test);
};
const _extractKeyMatchRuleFromStr = (text) => {
    const quotedTerminator = '"=';
    const unquotedTerminator = '=';
    const isQuotedCase = text[0] === '"';
    const [terminator, needlePosition] = isQuotedCase
        ? [quotedTerminator, 1]
        : [unquotedTerminator, 0];
    const indexOfTerminator = text.indexOf(terminator, needlePosition);
    if (indexOfTerminator === -1) {
        throw new Error(`Unable to parse key rule from ${text}. Key rule starts with `
            + `${text[0]}, but doesn't include '${terminator}'`);
    }
    const testCaseStr = text.slice(needlePosition, indexOfTerminator);
    const testCaseFunc = _testMatches.bind(undefined, testCaseStr);
    const finalNeedlePosition = indexOfTerminator + terminator.length;
    return [testCaseFunc, finalNeedlePosition];
};
const _extractValueMatchRuleFromStr = (text, needlePosition = 0) => {
    const isQuotedCase = text[needlePosition] === '"';
    let endIndex;
    if (isQuotedCase) {
        if (text.at(-1) !== '"') {
            throw new Error(`Unable to parse value rule from ${text}. Value rule starts with `
                + '" but doesn\'t end with "');
        }
        needlePosition += 1;
        endIndex = text.length - 1;
    }
    else {
        endIndex = text.length;
    }
    const testCaseStr = text.slice(needlePosition, endIndex);
    const testCaseFunc = _testMatches.bind(undefined, testCaseStr);
    return testCaseFunc;
};
// Parse an argument like `"abc"="xyz"` into
// a test for the key, and a test for the value.
// This will return two functions then, that you
// should use for checking the key and values
// in your test case.
//
// const key = ..., value = ...
// const [keyTestFunc, valueTestFunc] = _parseKeyValueMatchArg(arg)
//
// if (keyTestFunc(key))) {
//   // key matches the test condition
// }
const _parseKeyValueMatchRules = (arg) => {
    const [keyMatchRule, needlePos] = _extractKeyMatchRuleFromStr(arg);
    const valueMatchRule = _extractValueMatchRuleFromStr(arg, needlePos);
    return [keyMatchRule, valueMatchRule];
};
const _parseCSSInstruction = (arg) => {
    const rs = arg.split(':');
    if (rs.length !== 2) {
        throw Error(`Unexpected format for a CSS rule: ${arg}`);
    }
    return [rs[0].trim(), rs[1].trim()];
};
const _allOtherSiblings = (element) => {
    if (!element.parentNode) {
        return [];
    }
    const siblings = Array.from(element.parentNode.children);
    const otherHTMLElements = [];
    for (const sib of siblings) {
        if (sib === element) {
            continue;
        }
        const siblingHTMLElement = _asHTMLElement(sib);
        if (siblingHTMLElement !== null) {
            otherHTMLElements.push(siblingHTMLElement);
        }
    }
    return otherHTMLElements;
};
const _nextSiblingElement = (element) => {
    if (!element.parentNode) {
        return null;
    }
    const siblings = W.Array.from(element.parentNode.children);
    const indexOfElm = siblings.indexOf(element);
    const nextSibling = siblings[indexOfElm + 1];
    if (nextSibling === undefined) {
        return null;
    }
    return _asHTMLElement(nextSibling);
};
const _allChildren = (element) => {
    return W.Array.from(element.children)
        .map(e => _asHTMLElement(e))
        .filter(e => e !== null);
};
const _allChildrenRecursive = (element) => {
    return W.Array.from(element.querySelectorAll(':scope *'))
        .map(e => _asHTMLElement(e))
        .filter(e => e !== null);
};
const _stripCssOperator = (operator, selector) => {
    if (selector[0] !== operator) {
        throw new Error(`Expected to find ${operator} in initial position of "${selector}`);
    }
    return selector.replace(operator, '').trimStart();
};
const _hasPlainSelectorCase = (selector, element) => {
    return element.matches(selector) ? [element] : [];
};
const _hasProceduralSelectorCase = (selector, element) => {
    var _a;
    const shouldBeGreedy = ((_a = selector[0]) === null || _a === void 0 ? void 0 : _a.type) !== 'css-selector';
    const initElements = shouldBeGreedy
        ? _allChildrenRecursive(element)
        : [element];
    const matches = main.compileAndApplyProceduralSelector(selector, initElements);
    return matches.length === 0 ? [] : [element];
};
const _notPlainSelectorCase = (selector, element) => {
    return element.matches(selector) ? [] : [element];
};
const _notProceduralSelectorCase = (selector, element) => {
    const matches = main.compileAndApplyProceduralSelector(selector, [element]);
    return matches.length === 0 ? [element] : [];
};
const _upwardIntCase = (intNeedle, element) => {
    if (intNeedle < 1 || intNeedle >= 256) {
        throw new Error(`upward: invalid arg, ${intNeedle}`);
    }
    let currentElement = element;
    while (currentElement !== null && intNeedle > 0) {
        currentElement = currentElement.parentNode;
        intNeedle -= 1;
    }
    if (currentElement === null) {
        return [];
    }
    else {
        const htmlElement = _asHTMLElement(currentElement);
        return (htmlElement === null) ? [] : [htmlElement];
    }
};
const _upwardProceduralSelectorCase = (selector, element) => {
    const childFilter = main.compileProceduralSelector(selector);
    let needle = element;
    while (needle !== null) {
        const currentElement = _asHTMLElement(needle);
        if (currentElement === null) {
            break;
        }
        const matches = main.applyCompiledSelector(childFilter, [currentElement]);
        if (matches.length !== 0) {
            return [currentElement];
        }
        needle = currentElement.parentNode;
    }
    return [];
};
const _upwardPlainSelectorCase = (selector, element) => {
    let needle = element;
    while (needle !== null) {
        const currentElement = _asHTMLElement(needle);
        if (currentElement === null) {
            break;
        }
        if (currentElement.matches(selector)) {
            return [currentElement];
        }
        needle = currentElement.parentNode;
    }
    return [];
};
export { _allChildren, _allOtherSiblings, _asHTMLElement, _extractValueMatchRuleFromStr, _hasPlainSelectorCase, _hasProceduralSelectorCase, _nextSiblingElement, _notPlainSelectorCase, _notProceduralSelectorCase, _parseCSSInstruction, _parseKeyValueMatchRules, _stripCssOperator, _upwardIntCase, _upwardPlainSelectorCase, _upwardProceduralSelectorCase, };
