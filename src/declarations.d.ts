// Rules are raw data that are each parsed into a operators. A list of
// operators are a filter.

/* as provided by adblock-rust */
interface ProceduralOperator {
  type: OperatorType
  arg: string
}
type ProceduralSelector = ProceduralOperator[]

type CSSSelector = string
type CSSInstruction = string
type CSSValue = string

type OperatorType = string
type OperatorArg = CSSSelector | ProceduralSelector | string
type OperatorResult = HTMLElement | HTMLElement[] | null

type UnboundStringFunc = (arg: string, element: HTMLElement) => OperatorResult
type UnboundChildRuleOrStringFunc = (
  arg: string | ProceduralSelector,
  element: HTMLElement) => OperatorResult
type UnboundOperatorFunc = UnboundStringFunc | UnboundChildRuleOrStringFunc
type OperatorFunc = (element: HTMLElement) => OperatorResult

/* post-processed for convenient usage in JS */
interface CompiledProceduralOperator {
  type: OperatorType
  func: OperatorFunc
  args: OperatorArg[]
}
type CompiledProceduralSelector = CompiledProceduralOperator[]

type NeedlePosition = number
type TextMatchRule = (targetText: string, exact?: boolean) => boolean
type KeyValueMatchRules = [
  keyMatchRule: TextMatchRule,
  valueMatchRule: TextMatchRule,
]
