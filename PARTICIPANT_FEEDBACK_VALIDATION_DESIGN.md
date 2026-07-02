# Participant Feedback, Validation, and Progression Design

This document combines the design questions from:

- [Improve Provide Feedback Options for Training](https://github.com/revisit-studies/study/issues/526)
- [Add response validation for all response types](https://github.com/revisit-studies/study/issues/486)
- [Built in validations](https://github.com/revisit-studies/study/issues/751)
- [Extending feedback types and options](https://github.com/revisit-studies/study/issues/637)

The goal is to define a flexible study config interface that lets a Study Designer validate participant responses, evaluate correctness, show participant-facing feedback, and control training progression.

## Proposed Conceptual Model

The default design separates four related concerns:

- `validation`: Determines whether a response is acceptable input. Examples: required answer, valid email, number within range, text matches regex.
- `evaluation`: Determines whether an acceptable response is correct, partially correct, or incorrect. Examples: equals expected answer, selected option is correct, numeric estimate is within tolerance.
- `feedback`: Determines what participant-facing message or hint is shown after validation or evaluation.
- `progression`: Determines whether the Participant can continue, retry, pass a trial, pass a training block, or see a summary.

This separation keeps form validity distinct from training correctness. For example, a numeric answer can be valid because it is inside the allowed input range, but still incorrect because it is outside the target answer tolerance.

## Core Defaults

| Question | Default |
| --- | --- |
| What does validation mean? | `validation` means input acceptability, not correctness. |
| Should correctness be separate? | Yes. Use separate concepts: `validation`, `evaluation`, `feedback`, and `progression`. |
| Does invalid input block submission? | Yes. Invalid input blocks submission. Incorrect but valid input may submit unless `progression` blocks it. |
| Can feedback attach to both invalid and incorrect answers? | Yes. Feedback can be attached to validation failures and evaluation outcomes. |

## Built-In Rule Defaults

| Question | Default |
| --- | --- |
| Which built-ins should v1 support? | `required`, `equals`, `notEquals`, `oneOf`, `notOneOf`, `min`, `max`, `range`, `length`, `regex`, `includes`. |
| Should numeric tolerance be supported? | Support absolute tolerance in v1. Defer percent tolerance unless it is easy to include. |
| Are numeric bounds inclusive? | Yes. Bounds are inclusive by default. |
| What does checkbox `equals` mean? | Exact set equality. Also add explicit `containsAll` and `containsAny` rules. |
| How should object-shaped answers be validated? | Validate the normalized stored answer value by default. Allow an optional `path` for object answers. |

## Rule Combination Defaults

| Question | Default |
| --- | --- |
| How are multiple rules combined? | Multiple rules default to `AND`. |
| Are `OR` groups required in v1? | No. Defer `OR` groups until there is a clear use case. |
| Should rules have names? | Yes. Every rule may have an optional `id`; the system can generate one if omitted. |
| Can one response have multiple targets? | Yes. One response can have multiple validation or evaluation targets. |

## Feedback Defaults

| Question | Default |
| --- | --- |
| Where can feedback be configured? | Per rule and per option. Trial-level fallback feedback applies only when no more specific message exists. |
| Which feedback states are built in? | `valid`, `invalid`, `correct`, `incorrect`, and `partial`. |
| Should feedback support templates? | Yes. Templates should support participant answer, expected answer, option label, attempt number, score, and tolerance. |
| Should feedback reveal the correct answer? | Only when explicitly configured. |
| When does feedback appear? | Validation feedback appears after submit or blur. Correctness feedback appears after submit. |
| Should directional numeric feedback be built in? | Yes. Numeric evaluation should support `tooLow`, `tooHigh`, and `withinTolerance`. |

## Progression Defaults

| Question | Default |
| --- | --- |
| Which trial-level progression modes should exist? | `allowContinue`, `blockUntilValid`, `retryUntilCorrect`, and `retryUntilMaxAttempts`. |
| Where is max attempts configured? | Per trial by default, with optional response-level override. |
| What happens after max attempts? | Allow continue, but mark the trial failed unless configured otherwise. |
| How does a training section pass by default? | Percent correct. Default threshold is `100%` unless specified. |
| Is a built-in summary page required for v1? | No. Expose enough state for summaries in v1; a built-in summary page can be a follow-up. |
| Can progression rules apply outside training? | Yes, but documentation should present them as training-focused. |

## Custom Function Defaults

| Question | Default |
| --- | --- |
| How are custom functions provided? | Referenced from approved study or library code, not inline JavaScript strings. |
| Are async functions supported in v1? | No. Custom functions are sync only in v1. |
| What inputs does a function receive? | Answer, response config, trial config, attempt number, prior attempts, and current participant answers. |
| What does a function return? | A structured result such as `{ valid, score, feedback, metadata }` or `{ evaluation, score, feedback, metadata }`. |
| Are custom functions allowed in deployed studies? | Yes, but only through the existing trusted config/library mechanism. Arbitrary inline deployment code is not allowed. |

## Data and Analysis Defaults

| Question | Default |
| --- | --- |
| What answer data is stored? | Final submitted answers plus attempt history when validation, evaluation, feedback, or progression is configured. |
| What result data is stored? | Validation result, evaluation result, feedback id or message shown, rule ids, score, and attempt number. |
| Should blocked invalid attempts be distinguishable? | Yes. Analysts should be able to distinguish blocked invalid attempts from submitted incorrect answers. |
| Should feedback and progression enter provenance? | Yes. Feedback and progression events should be included in provenance tracking. |

## Config Shape Defaults

| Question | Default |
| --- | --- |
| Where does response-level config live? | Under response-level `validation`, `evaluation`, `feedback`, and `progression` fields. |
| Is block-level progression needed? | Yes. Add sequence or block-level `progression` for aggregate training pass/fail behavior. |
| Where does option-level feedback live? | Embedded directly on options by default, with rule references allowed for advanced cases. |
| How is existing right/wrong behavior handled? | Preserve existing behavior by translating it into `evaluation`. |
| Should unsupported rules be rejected by schema? | Yes for clearly unsupported built-ins. Custom functions can target arbitrary values. |

## Participant UX Defaults

| Question | Default |
| --- | --- |
| Where do validation messages appear? | Inline near the response. |
| Where does correctness feedback appear? | In the existing feedback area. |
| Should blocked progression explain itself? | Yes. The UI should explain why Next is unavailable. |
| Should numeric inputs silently clamp? | No. Preserve typed invalid values where feasible and show a warning. |
| Which feedback severities are built in? | `error`, `warning`, `info`, `success`, and `hint`. |

## Draft Config Sketch

This sketch is illustrative. Field names and exact types should be refined during implementation.

```json
{
  "response": [
    {
      "id": "estimate",
      "type": "numerical",
      "prompt": "Estimate the correlation.",
      "validation": [
        {
          "id": "required-estimate",
          "type": "required",
          "message": "Enter an estimate before continuing."
        },
        {
          "id": "estimate-range",
          "type": "range",
          "min": -1,
          "max": 1,
          "message": "Enter a value between -1 and 1."
        }
      ],
      "evaluation": [
        {
          "id": "target-correlation",
          "type": "equals",
          "value": 0.62,
          "tolerance": 0.05,
          "feedback": {
            "correct": "Correct.",
            "incorrect": "That estimate is outside the acceptable range.",
            "tooLow": "Try a higher value.",
            "tooHigh": "Try a lower value."
          }
        }
      ],
      "progression": {
        "mode": "retryUntilMaxAttempts",
        "maxAttempts": 3
      }
    }
  ]
}
```

## Open Design Decisions

The defaults above still leave these higher-level choices to confirm:

- Whether `evaluation` is the right name, or whether the config should use `grading`, `scoring`, or another term.
- Whether percent tolerance belongs in v1.
- Whether `OR` rule groups are needed immediately.
- Whether a built-in training summary page should be part of the first implementation.
- Whether custom functions should use the same mechanism as existing dynamic functions.
- Which exact values custom functions can access without exposing too much participant or study state.
- How much existing right/wrong training config exists and how it should migrate.
