import { useState } from "react";
import { errorSummary, hasErrors, revalidate, type FieldErrors } from "@/lib/validation";

/**
 * The app's form pattern: validate on submit, then re-check only the fields already flagged as the user types.
 * `goal` finishes the summary line, as in "Fix the 2 highlighted fields to save."
 */
export function useValidatedForm<V extends object, K extends string>(
  initial: V,
  validate: (values: V) => FieldErrors<K>,
  goal?: string
) {
  const [values, setValues] = useState<V>(initial);
  const [errors, setErrors] = useState<FieldErrors<K>>({});
  const [summary, setSummary] = useState("");

  function update(patch: Partial<V>) {
    const next = { ...values, ...patch };
    setValues(next);
    if (!hasErrors(errors)) return;
    const kept = revalidate(errors, validate(next));
    setErrors(kept);
    if (!hasErrors(kept)) setSummary("");
  }

  /** Flags everything wrong and says whether the form is good to send. */
  function check(): boolean {
    const found = validate(values);
    setErrors(found);
    setSummary(goal ? errorSummary(found, goal) : "");
    return !hasErrors(found);
  }

  return { values, setValues, errors, setErrors, summary, setSummary, update, check };
}
