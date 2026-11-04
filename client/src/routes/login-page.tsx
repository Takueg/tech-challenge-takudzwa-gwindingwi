import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ErrorBanner, FieldError } from "@/components/app/form-parts";
import { LogoMark } from "@/components/app/logo";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "@/context/current-user";
import { useValidatedForm } from "@/hooks/use-validated-form";
import { httpStatusOf, errorMessage } from "@/lib/error-message";
import { useTRPC } from "@/lib/trpc";
import type { FieldErrors } from "@/lib/validation";

type Values = { username: string; password: string };
type Errors = FieldErrors<keyof Values>;

function validate({ username, password }: Values): Errors {
  const errors: Errors = {};
  if (!username.trim()) errors.username = "Enter your username";
  if (!password) errors.password = "Enter your password";
  return errors;
}

export function LoginPage() {
  const trpc = useTRPC();
  const location = useLocation();
  const { currentUserId, setCurrentUserId } = useCurrentUser();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const { values, setValues, errors, update, check } = useValidatedForm<Values, keyof Values>(
    { username: "", password: "" },
    validate
  );
  const [showPassword, setShowPassword] = useState(false);
  const [failures, setFailures] = useState(0);
  const [authError, setAuthError] = useState<string | null>(null);
  const [outage, setOutage] = useState<string | null>(null);

  const login = useMutation(
    trpc.auth.login.mutationOptions({
      meta: { handlesError: true },
      onSuccess: (user) => setCurrentUserId(user.id),
      onError: (error) => {
        // An outage isn't a wrong password, so keep what they typed and don't blame the fields.
        if (httpStatusOf(error) !== 401) {
          setOutage(errorMessage(error));
          return;
        }
        setValues((current) => ({ ...current, password: "" }));
        const tries = failures + 1;
        setFailures(tries);
        setAuthError(
          tries >= 3
            ? "Still not right. Check caps lock, or use one of the demo accounts below."
            : "Check your username and password for typos and try again."
        );
      },
    })
  );

  if (currentUserId) return <Navigate to={from} replace />;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (login.isPending) return;
    setAuthError(null);
    setOutage(null);
    if (!check()) return;
    login.mutate({ username: values.username.trim(), password: values.password });
  }

  const usernameInvalid = Boolean(errors.username || authError);
  const passwordInvalid = Boolean(errors.password || authError);

  return (
    <main className="box-border flex min-h-screen flex-col items-center justify-center gap-8 bg-screen px-4 py-12 text-on-screen">
      <div className="flex flex-col items-center gap-3.5 text-center">
        <span role="img" aria-label="SplitwiseLite" className="flex items-center gap-3.5">
          <LogoMark size={56} />
          <span aria-hidden="true" className="whitespace-nowrap type-p700-30-1 tracking-[-0.01em]">
            SplitwiseLite
          </span>
        </span>
        <span className="type-s400-16-1_3">Split costs with friends, minus the awkward maths.</span>
      </div>

      <div className="box-border flex w-[460px] max-w-full flex-col gap-[22px] rounded-[40px] bg-sheet px-[37px] pt-11 pb-9 text-foreground">
        <form noValidate onSubmit={submit} aria-labelledby="li-title" className="flex flex-col gap-5">
          <h1 id="li-title" className="m-0 text-center type-p600-30-36 text-strong">
            Welcome Back
          </h1>
          {outage && <ErrorBanner title="We couldn’t log you in">{outage}</ErrorBanner>}
          {authError && (
            <ErrorBanner icon="error" title="That didn’t match">
              {authError}
            </ErrorBanner>
          )}
          <div className="swl-field">
            <Label htmlFor="li-user">Username</Label>
            <Input
              id="li-user"
              type="text"
              placeholder="alice"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              invalid={usernameInvalid}
              aria-describedby={errors.username ? "li-user-err" : undefined}
              value={values.username}
              onChange={(event) => update({ username: event.target.value })}
            />
            {errors.username && <FieldError id="li-user-err">{errors.username}</FieldError>}
          </div>
          <div className="swl-field">
            <Label htmlFor="li-pass">Password</Label>
            <Input
              id="li-pass"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              invalid={passwordInvalid}
              aria-describedby={errors.password ? "li-pass-err" : undefined}
              value={values.password}
              onChange={(event) => update({ password: event.target.value })}
              trailing={
                <button
                  type="button"
                  className="swl-field__eye"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((shown) => !shown)}
                >
                  <Icon name={showPassword ? "visibility" : "visibility_off"} size={20} />
                </button>
              }
            />
            {errors.password && <FieldError id="li-pass-err">{errors.password}</FieldError>}
          </div>
          <div className="pt-1">
            <Button type="submit" block disabled={login.isPending}>
              {login.isPending ? "Logging In…" : "Log In"}
            </Button>
          </div>
          <div className="flex items-start gap-3 rounded-[18px] bg-sunken px-4 py-3.5">
            <Icon name="info" size={20} />
            <span className="type-p400-13-19">
              Demo accounts: <strong className="font-semibold">alice</strong>,{" "}
              <strong className="font-semibold">bob</strong> and <strong className="font-semibold">carol</strong>. The
              password is the username plus 123, e.g. alice123.
            </span>
          </div>
        </form>
      </div>
    </main>
  );
}
