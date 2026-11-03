import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";
import { useCurrentUser } from "@/context/current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginPage() {
  const trpc = useTRPC();
  const navigate = useNavigate();
  const { setCurrentUserId } = useCurrentUser();
  const [step, setStep] = useState<"username" | "password">("username");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const login = useMutation(
    trpc.auth.login.mutationOptions({
      onSuccess: (user) => {
        setCurrentUserId(user.id);
        navigate("/welcome", { state: { name: user.name } });
      },
    })
  );

  return (
    <div className="mx-auto max-w-sm py-16">
      <Card>
        <CardHeader>
          <CardTitle>Log in</CardTitle>
        </CardHeader>
        <CardContent>
          {step === "username" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="alice"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">Demo users: alice, bob, carol (password: username + 123)</p>
              </div>
              <Button
                className="w-full"
                disabled={username.trim().length === 0}
                onClick={() => setStep("password")}
              >
                Next
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">Logging in as {username}</p>
              </div>
              <Button
                className="w-full"
                disabled={password.length === 0 || login.isPending}
                onClick={() => login.mutate({ username, password })}
              >
                {login.isPending ? "Logging in…" : "Log in"}
              </Button>
              <button
                type="button"
                className="w-full text-center text-xs text-muted-foreground underline"
                onClick={() => setStep("username")}
              >
                Back
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
