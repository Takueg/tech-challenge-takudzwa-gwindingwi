import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { CurrentUserProvider } from "@/context/current-user";
import { AppShell } from "@/components/app/app-shell";
import { RequireAuth } from "@/components/app/require-auth";
import { DashboardPage } from "@/routes/dashboard-page";
import { GroupDetailPage } from "@/routes/group-detail-page";
import { LoginPage } from "@/routes/login-page";
import { SettingsPage } from "@/routes/settings-page";

function App() {
  return (
    <CurrentUserProvider>
      <Toaster position="top-right" containerStyle={{ top: 24, right: 24, zIndex: 60 }} gutter={12} />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <AppShell />
              </RequireAuth>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/groups/:groupId" element={<GroupDetailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="/profile" element={<Navigate to="/settings" replace />} />
          <Route path="/welcome" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </CurrentUserProvider>
  );
}

export default App;
