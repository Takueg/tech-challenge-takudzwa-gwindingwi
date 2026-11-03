import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function WelcomePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const name = (location.state as { name?: string } | null)?.name ?? "there";

  return (
    <div className="mx-auto max-w-sm py-16">
      <Card>
        <CardHeader>
          <CardTitle>Welcome back, {name}!</CardTitle>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => navigate("/")}>
            Continue to your groups
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
