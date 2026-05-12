---
name: test-driven-development
description: "Use when implementing any feature or bugfix, before writing implementation code. Enforces the red-green-refactor cycle: failing test first, watch it fail, minimal code to pass, then refactor. The core engineering-team build loop after brainstorming and writing-plans. Trigger phrases: 'TDD', 'write a test', 'test-first', 'add a feature', 'fix this bug', 'implement X'."
license: MIT
allowed-tools: Bash, Read, Write, Edit, Grep, Glob
metadata:
  status: authored
  domain: engineering
  mode: local
  mcp-server: none
  external-apis: []
  outputs: []
  source: https://github.com/obra/superpowers
  source-license: MIT
  source-author: Jesse Vincent
---

# Test-Driven Development (TDD)

## Overview

Write the test first. Watch it fail. Write minimal code to pass.

**Core principle:** If you didn't watch the test fail, you don't know if it tests the right thing.

**Violating the letter of the rules is violating the spirit of the rules.**

## When to Use

**Always:**
- New features
- Bug fixes
- Refactoring
- Behavior changes

**Exceptions (ask the user):**
- Throwaway prototypes
- Generated code
- Configuration files

Thinking "skip TDD just this once"? Stop. That's rationalization.

## The Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

Wrote code before the test? Delete it. Start over.

**No exceptions:**
- Don't keep it as "reference"
- Don't "adapt" it while writing tests
- Don't look at it
- Delete means delete

Implement fresh from tests. Period.

## Red-Green-Refactor

### RED: write failing test

Write one minimal test showing what should happen.

Good example:

```typescript
test('retries failed operations 3 times', async () => {
  let attempts = 0;
  const operation = () => {
    attempts++;
    if (attempts < 3) throw new Error('fail');
    return 'success';
  };

  const result = await retryOperation(operation);

  expect(result).toBe('success');
  expect(attempts).toBe(3);
});
```

Clear name, tests real behavior, one thing.

Bad example:

```typescript
test('retry works', async () => {
  const mock = jest.fn()
    .mockRejectedValueOnce(new Error())
    .mockRejectedValueOnce(new Error())
    .mockResolvedValueOnce('success');
  await retryOperation(mock);
  expect(mock).toHaveBeenCalledTimes(3);
});
```

Vague name, tests the mock not the code.

**Requirements:**
- One behavior
- Clear name
- Real code (no mocks unless unavoidable)

### Verify RED: watch it fail

**MANDATORY. Never skip.**

```bash
npm test path/to/test.test.ts
```

Confirm:
- Test fails (not errors)
- Failure message is expected
- Fails because feature is missing (not typos)

**Test passes?** You're testing existing behavior. Fix the test.

**Test errors?** Fix the error, re-run until it fails correctly.

### GREEN: minimal code

Write the simplest code to pass the test.

Good:

```typescript
async function retryOperation<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === 2) throw e;
    }
  }
  throw new Error('unreachable');
}
```

Just enough to pass.

Bad:

```typescript
async function retryOperation<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    backoff?: 'linear' | 'exponential';
    onRetry?: (attempt: number) => void;
  }
): Promise<T> {
  // YAGNI
}
```

Over-engineered.

Don't add features, refactor other code, or "improve" beyond the test.

### Verify GREEN: watch it pass

**MANDATORY.**

```bash
npm test path/to/test.test.ts
```

Confirm:
- Test passes
- Other tests still pass
- Output pristine (no errors, no warnings)

**Test fails?** Fix the code, not the test.

**Other tests fail?** Fix them now.

### REFACTOR: clean up

After green only:
- Remove duplication
- Improve names
- Extract helpers

Keep tests green. Don't add behavior.

### Repeat

Next failing test for the next feature.

## Good tests

| Quality       | Good                                            | Bad                                              |
|---------------|-------------------------------------------------|--------------------------------------------------|
| Minimal       | One thing. "and" in name? Split it.             | `test('validates email and domain and whitespace')` |
| Clear         | Name describes behavior                         | `test('test1')`                                  |
| Shows intent  | Demonstrates desired API                        | Obscures what the code should do                 |

## Why order matters

**"I'll write tests after to verify it works"**

Tests written after code pass immediately. Passing immediately proves nothing:
- Might test wrong thing
- Might test implementation, not behavior
- Might miss edge cases you forgot
- You never saw it catch the bug

Test-first forces you to see the test fail, proving it actually tests something.

**"I already manually tested all the edge cases"**

Manual testing is ad-hoc. You think you tested everything but:
- No record of what you tested
- Can't re-run when code changes
- Easy to forget cases under pressure
- "It worked when I tried it" is not the same as comprehensive

Automated tests are systematic. They run the same way every time.

**"Deleting X hours of work is wasteful"**

Sunk cost fallacy. The time is already gone. Your choice now:
- Delete and rewrite with TDD (X more hours, high confidence)
- Keep it and add tests after (30 min, low confidence, likely bugs)

The "waste" is keeping code you can't trust. Working code without real tests is technical debt.

**"TDD is dogmatic, being pragmatic means adapting"**

TDD IS pragmatic:
- Finds bugs before commit (faster than debugging after)
- Prevents regressions (tests catch breaks immediately)
- Documents behavior (tests show how to use the code)
- Enables refactoring (change freely, tests catch breaks)

"Pragmatic" shortcuts mean debugging in production, which is slower.

**"Tests after achieve the same goals, it's spirit not ritual"**

No. Tests-after answer "what does this do?" Tests-first answer "what should this do?"

Tests-after are biased by your implementation. You test what you built, not what's required. You verify remembered edge cases, not discovered ones.

Tests-first force edge case discovery before implementing. Tests-after verify you remembered everything (you didn't).

30 minutes of tests after is not TDD. You get coverage, lose proof tests work.

## Common rationalizations

| Excuse                                       | Reality                                                         |
|----------------------------------------------|-----------------------------------------------------------------|
| "Too simple to test"                         | Simple code breaks. Test takes 30 seconds.                      |
| "I'll test after"                            | Tests passing immediately prove nothing.                        |
| "Tests after achieve same goals"             | After: what does this do? First: what should this do?            |
| "Already manually tested"                    | Ad-hoc is not systematic. No record, can't re-run.              |
| "Deleting X hours is wasteful"               | Sunk cost. Keeping unverified code is technical debt.            |
| "Keep as reference, write tests first"       | You'll adapt it. That's testing after. Delete means delete.     |
| "Need to explore first"                      | Fine. Throw away exploration, start with TDD.                   |
| "Test hard means design unclear"             | Listen to the test. Hard to test means hard to use.             |
| "TDD will slow me down"                      | TDD is faster than debugging. Pragmatic means test-first.       |
| "Manual test faster"                         | Manual doesn't prove edge cases.                                |
| "Existing code has no tests"                 | You're improving it. Add tests for existing code.               |

## Red Flags: stop and start over

- Code before test
- Test after implementation
- Test passes immediately
- Can't explain why test failed
- Tests added "later"
- Rationalizing "just this once"
- "I already manually tested it"
- "Tests after achieve the same purpose"
- "It's about spirit not ritual"
- "Keep as reference" or "adapt existing code"
- "Already spent X hours, deleting is wasteful"
- "TDD is dogmatic, I'm being pragmatic"
- "This is different because..."

**All of these mean: delete code. Start over with TDD.**

## Example: bug fix

**Bug:** empty email accepted.

**RED:**
```typescript
test('rejects empty email', async () => {
  const result = await submitForm({ email: '' });
  expect(result.error).toBe('Email required');
});
```

**Verify RED:**
```bash
$ npm test
FAIL: expected 'Email required', got undefined
```

**GREEN:**
```typescript
function submitForm(data: FormData) {
  if (!data.email?.trim()) {
    return { error: 'Email required' };
  }
  // ...
}
```

**Verify GREEN:**
```bash
$ npm test
PASS
```

**REFACTOR:** extract validation for multiple fields if needed.

## Verification checklist

Before marking work complete:

- [ ] Every new function or method has a test
- [ ] Watched each test fail before implementing
- [ ] Each test failed for the expected reason (feature missing, not typo)
- [ ] Wrote minimal code to pass each test
- [ ] All tests pass
- [ ] Output pristine (no errors, no warnings)
- [ ] Tests use real code (mocks only if unavoidable)
- [ ] Edge cases and errors covered

Can't check all boxes? You skipped TDD. Start over.

## When stuck

| Problem                       | Solution                                                      |
|-------------------------------|---------------------------------------------------------------|
| Don't know how to test        | Write wished-for API. Write assertion first. Ask the user.    |
| Test too complicated          | Design too complicated. Simplify the interface.               |
| Must mock everything          | Code too coupled. Use dependency injection.                   |
| Test setup huge               | Extract helpers. Still complex? Simplify design.              |

## Debugging integration

Bug found? Write a failing test reproducing it. Follow the TDD cycle. The test proves the fix and prevents regression. Never fix bugs without a test.

Use `systematic-debugging` (in `_meta/`) to investigate before writing the failing test.

## Testing anti-patterns to avoid

- Testing mock behavior instead of real behavior
- Adding test-only methods to production classes
- Mocking without understanding dependencies
- Asserting on internal implementation rather than observable behavior

## Final rule

```
Production code: test exists and failed first
Otherwise: not TDD
```

No exceptions without the user's permission.

## Related skills

- `brainstorming` (in `engineering/`) - precedes TDD, defines what to test
- `writing-plans` (in `_meta/`) - the implementation plan should call out test cases
- `systematic-debugging` (in `_meta/`) - investigate before writing the failing test
- `verification-before-completion` (in `_meta/`) - run before claiming the feature is done
- `finishing-a-development-branch` (in `engineering/`) - the merge step after tests are green
