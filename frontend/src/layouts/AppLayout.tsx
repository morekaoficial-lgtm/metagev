import { ReactNode, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { useI18n } from '../i18n/I18nContext';

interface MenuItem {
  to: string;
  labelKey: string;
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const menu: MenuItem[] = [];
  const role = user?.role;
  const isAdmin = role === 'RRHH' || role === 'DUENO';
  const isEvaluated = role === 'COLABORADOR' || role === 'JEFE' || role === 'RRHH';
  const isValidator = role === 'JEFE' || role === 'RRHH' || role === 'DUENO';

  if (isAdmin) {
    menu.push(
      { to: '/admin/usuarios', labelKey: 'menu.users' },
      { to: '/admin/sucursales', labelKey: 'menu.branches' },
      { to: '/admin/catalogo', labelKey: 'menu.catalog' },
      { to: '/admin/periodos', labelKey: 'menu.periods' },
      { to: '/admin/objetivos', labelKey: 'menu.objectives' },
      { to: '/admin/analitica', labelKey: 'menu.analytics' },
      { to: '/admin/recibos', labelKey: 'menu.receipts' },
    );
  }
  if (isEvaluated) {
    menu.push(
      { to: '/mis-objetivos', labelKey: 'menu.myObjectives' },
      { to: '/evaluacion', labelKey: 'menu.evaluation' },
      { to: '/historico', labelKey: 'menu.history' },
    );
  }
  if (isValidator) {
    menu.push(
      { to: '/historico-equipo', labelKey: 'menu.teamHistory' },
      { to: '/validacion', labelKey: 'menu.validation' },
    );
  }
  if (role === 'JEFE') {
    menu.push({ to: '/admin/objetivos', labelKey: 'menu.objectives' });
  }

  const close = () => setOpen(false);

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Overlay oscuro detrás del menú móvil */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: off-canvas en móvil, fija en escritorio */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-gray-900 text-gray-100 flex flex-col transform transition-transform duration-200 md:static md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-6 py-5 border-b border-gray-800 flex items-start justify-between gap-2">
          <div>
            <div className="text-sm font-semibold leading-tight">{t('app.name')}</div>
            <div className="text-xs text-gray-400 mt-1">{t('app.tagline')}</div>
          </div>
          <button
            onClick={close}
            className="md:hidden text-gray-400 hover:text-white text-xl leading-none"
            aria-label={t('common.close')}
          >
            ×
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {menu.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={close}
              className={({ isActive }) =>
                `block px-3 py-2.5 rounded text-sm ${
                  isActive ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800'
                }`
              }
            >
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-gray-800 text-sm">
          <div className="text-gray-300 font-medium">{user?.fullName}</div>
          <div className="text-xs text-gray-500">{user ? t(`roles.${user.role}`) : ''}</div>
          <button
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
            className="mt-3 w-full text-left text-xs text-gray-400 hover:text-white py-1"
          >
            {t('app.logout')}
          </button>
        </div>
      </aside>

      {/* Contenido: columna con header móvil + main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Barra superior solo en móvil */}
        <header className="md:hidden sticky top-0 z-20 bg-gray-900 text-gray-100 flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => setOpen(true)}
            className="p-1 -ml-1 text-gray-200 hover:text-white"
            aria-label="Menú"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{t('app.name')}</div>
            <div className="text-xs text-gray-400 truncate">{user?.fullName}</div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
