import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layouts/AppLayout';
import { RedirectByRole, RequireAuth, RoleRoute } from './components/guards';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminCatalogPage } from './pages/admin/AdminCatalogPage';
import { AdminPeriodsPage } from './pages/admin/AdminPeriodsPage';
import { AdminObjectivesPage } from './pages/admin/AdminObjectivesPage';
import { AdminAnalyticsPage } from './pages/admin/AdminAnalyticsPage';
import { AdminBranchesPage } from './pages/admin/AdminBranchesPage';
import { AdminReceiptsPage } from './pages/admin/AdminReceiptsPage';
import { MisObjetivosPage } from './pages/collaborator/MisObjetivosPage';
import { EvaluacionPage } from './pages/collaborator/EvaluacionPage';
import { HistoricoPage } from './pages/collaborator/HistoricoPage';
import { TeamHistoricoPage } from './pages/team/TeamHistoricoPage';
import { ValidacionListPage } from './pages/validator/ValidacionListPage';
import { ValidacionDetailPage } from './pages/validator/ValidacionDetailPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <AppLayout>
              <RedirectByRole />
            </AppLayout>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/usuarios"
        element={
          <RoleRoute roles={['RRHH', 'DUENO']}>
            <AppLayout>
              <AdminUsersPage />
            </AppLayout>
          </RoleRoute>
        }
      />
      <Route
        path="/admin/catalogo"
        element={
          <RoleRoute roles={['RRHH', 'DUENO']}>
            <AppLayout>
              <AdminCatalogPage />
            </AppLayout>
          </RoleRoute>
        }
      />
      <Route
        path="/admin/sucursales"
        element={
          <RoleRoute roles={['RRHH', 'DUENO']}>
            <AppLayout>
              <AdminBranchesPage />
            </AppLayout>
          </RoleRoute>
        }
      />
      <Route
        path="/admin/periodos"
        element={
          <RoleRoute roles={['RRHH', 'DUENO']}>
            <AppLayout>
              <AdminPeriodsPage />
            </AppLayout>
          </RoleRoute>
        }
      />
      <Route
        path="/admin/objetivos"
        element={
          <RoleRoute roles={['JEFE', 'RRHH', 'DUENO']}>
            <AppLayout>
              <AdminObjectivesPage />
            </AppLayout>
          </RoleRoute>
        }
      />
      <Route
        path="/admin/analitica"
        element={
          <RoleRoute roles={['RRHH', 'DUENO']}>
            <AppLayout>
              <AdminAnalyticsPage />
            </AppLayout>
          </RoleRoute>
        }
      />
      <Route
        path="/admin/recibos"
        element={
          <RoleRoute roles={['RRHH', 'DUENO']}>
            <AppLayout>
              <AdminReceiptsPage />
            </AppLayout>
          </RoleRoute>
        }
      />
      <Route
        path="/mis-objetivos"
        element={
          <RoleRoute roles={['COLABORADOR', 'JEFE', 'RRHH']}>
            <AppLayout>
              <MisObjetivosPage />
            </AppLayout>
          </RoleRoute>
        }
      />
      <Route
        path="/evaluacion"
        element={
          <RoleRoute roles={['COLABORADOR', 'JEFE', 'RRHH']}>
            <AppLayout>
              <EvaluacionPage />
            </AppLayout>
          </RoleRoute>
        }
      />
      <Route
        path="/historico"
        element={
          <RoleRoute roles={['COLABORADOR', 'JEFE', 'RRHH']}>
            <AppLayout>
              <HistoricoPage />
            </AppLayout>
          </RoleRoute>
        }
      />
      <Route
        path="/historico-equipo"
        element={
          <RoleRoute roles={['JEFE', 'RRHH', 'DUENO']}>
            <AppLayout>
              <TeamHistoricoPage />
            </AppLayout>
          </RoleRoute>
        }
      />
      <Route
        path="/validacion"
        element={
          <RoleRoute roles={['JEFE', 'RRHH', 'DUENO']}>
            <AppLayout>
              <ValidacionListPage />
            </AppLayout>
          </RoleRoute>
        }
      />
      <Route
        path="/validacion/:id"
        element={
          <RoleRoute roles={['JEFE', 'RRHH', 'DUENO']}>
            <AppLayout>
              <ValidacionDetailPage />
            </AppLayout>
          </RoleRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
