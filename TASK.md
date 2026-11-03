# Task

## The situation

Our intern built this app in two days, mostly with AI. It worked well
enough that people started using it for real, and investors like it —
so it's sticking around. The balances it shows are the ones people act
on: someone transfers real money based on what this app tells them they
owe.

What it hasn't had yet is a senior engineer looking at it. That's you.
Your job is to go through the codebase, find the AI slop — the bugs,
the shortcuts, the code that looks plausible but doesn't hold up — and
get it into a state that actually deserves to be in production and
that the team can maintain and build on long-term.

## What to look at

Review both `server/` and `client/`, and run the app — some problems
only show up when you click through it as a user. Areas we care about:

- **Bugs and correctness** — anything that produces wrong results,
  especially around money: amounts, balances, who owes whom. Think
  about edge cases and what happens when users don't behave as
  expected.
- **UI/UX clarity** — is it obvious what the app is showing and what
  an action will do? Are errors surfaced, or do things fail (or
  succeed wrongly) silently? Would a new user get confused?
- **Frontend antipatterns** — state handling, data fetching, component
  structure, anything that's fragile or will bite the next person who
  touches it.
- **Backend architecture** — how responsibilities are split, where
  business logic lives, validation, and whether the data model holds
  up.
- **Clean interfaces** — are the API procedures and component props
  clear, consistent, and hard to misuse?
- **Duplication and reusability** — logic that's implemented more than
  once, or code that should be shared but isn't.

You don't need to cover everything evenly — go deep where it matters.

## What we'd like you to do

1. When you find something that's wrong, risky, or harder to work with
   than it needs to be — do something about it. That can look like:
   - actual fix or refactor commits,
   - a written explanation of what you'd change and why (a `NOTES.md`
     you add, your PR description, inline comments — wherever's
     natural),
   - or both.
2. Use your judgment on what's worth fixing now versus just flagging
   for later. We're not expecting a rewrite — we're interested in what
   you noticed, how severe you think it is, what you prioritized, and
   why you drew the line where you did.

## Using AI tools

Use them the way you would on the job. We're not evaluating whether you
can type code quickly — we're evaluating what you find, what you check,
and what you'd stand behind in a PR review. An AI can point out a lot of
things fast, but you're the one who has to decide what actually matters
and why.
