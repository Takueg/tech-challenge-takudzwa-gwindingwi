import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { CurrentUserProvider, useCurrentUser } from "@/context/current-user";
import { UserPicker } from "@/components/app/user-picker";
import { RequireAuth } from "@/components/app/require-auth";
import { GroupsPage } from "@/routes/groups-page";
import { GroupDetailPage } from "@/routes/group-detail-page";
import { LoginPage } from "@/routes/login-page";
import { WelcomePage } from "@/routes/welcome-page";
import { ProfilePage } from "@/routes/profile-page";

function HeaderAuthLink() {
  const { currentUserId, logout } = useCurrentUser();

  if (currentUserId) {
    return (
      <button type="button" onClick={logout} className="text-sm text-muted-foreground underline">
        Log out
      </button>
    );
  }

  return (
    <Link to="/login" className="text-sm text-muted-foreground underline">
      Log in
    </Link>
  );
}

function App() {
  return (
    <CurrentUserProvider>
      <Toaster position="bottom-right" />
      <BrowserRouter>
        <div className="min-h-screen bg-background text-foreground">
          <header className="border-b">
            <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
              <Link to="/" className="font-semibold tracking-tight">
                Splitwise Lite
              </Link>
              <div className="flex items-center gap-4">
                <HeaderAuthLink />
                <Link to="/profile" className="text-sm text-muted-foreground underline">
                  Profile
                </Link>
                <UserPicker />
              </div>
            </div>
          </header>
          <main className="mx-auto max-w-3xl px-4 py-6">
            <Routes>
              <Route
                path="/"
                element={
                  <RequireAuth>
                    <GroupsPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/groups/:groupId"
                element={
                  <RequireAuth>
                    <GroupDetailPage />
                  </RequireAuth>
                }
              />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/welcome" element={<WelcomePage />} />
              <Route
                path="/profile"
                element={
                  <RequireAuth>
                    <ProfilePage />
                  </RequireAuth>
                }
              />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </CurrentUserProvider>
  );
}

export default App;
