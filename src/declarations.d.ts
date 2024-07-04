// Rules are raw data that are each parsed into a operators. A list of
// operators are a filter.

/* as provided by adblock-rust */
interface Rule {
  type: OperatorType
  arg: string
}

type CSSSelector = string
type CSSInstruction = string
type CSSValue = string

type OperatorType = string
type OperatorArg = CSSSelector | Rule[] | string
type OperatorResult = HTMLElement | HTMLElement[] | null
type UnboundOperatorFunc = (OperatorArg, HTMLElement) => OperatorResult
type OperatorFunc = (HTMLElement) => OperatorResult

/* post-processed for convenient usage in JS */
interface Operator {
  type: OperatorType
  func: OperatorFunc
  args: OperatorArg[]
}

type Filter = Operator[]

type NeedlePosition = number
type TextMatchRule = (targetText: string, exact: boolean = false) => boolean
type KeyValueMatchRules = [
  keyMatchRule: TextMatchRule,
  valueMatchRule: TextMatchRule,
]
