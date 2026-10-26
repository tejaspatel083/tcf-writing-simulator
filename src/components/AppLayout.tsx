import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { UserProfileModal } from './UserProfileModal';
import { DeviceRecommendationModal } from './DeviceRecommendationModal';
import {
  Home,
  BarChart3,
  BookOpen,
  FileEdit,
  Shield,
  User,
  LogOut,
  MessageSquare,
  ChevronsRight,
  ChevronDown,
  Menu,
  X,
  LucideIcon
} from 'lucide-react';

export type AppView = 'home' | 'dashboard' | 'simulator' | 'results' | 'feedback';

interface AppLayoutProps {
  currentView: AppView;
  title?: string;
  subtitle?: string;
  combinationTitle?: string;
  onNavigateHome: () => void;
  onNavigateDashboard: () => void;
  onNavigateMistakes?: () => void;
  mistakesCount?: number;
  isMistakesTabActive?: boolean;
  onNavigateFeedback: () => void;
  onStartNewExam?: () => void;
  onSignOut: () => void;
  submissionsCount?: number;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentView,
  title,
  subtitle,
  combinationTitle,
  onNavigateHome,
  onNavigateDashboard,
  onNavigateMistakes,
  mistakesCount,
  isMistakesTabActive,
  onNavigateFeedback,
  onStartNewExam,
  onSignOut,
  submissionsCount = 0,
  children
}) => {
  const { user, userName, isAdmin } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Persist sidebar open state
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    if (currentView === 'simulator') return false;
    const saved = localStorage.getItem('tcf_sidebar_open');
    if (saved !== null) return saved === 'true';
    return window.innerWidth >= 1024;
  });

  useEffect(() => {
    localStorage.setItem('tcf_sidebar_open', String(sidebarOpen));
  }, [sidebarOpen]);

  // Ensure day theme only: clear any previous dark mode settings
  useEffect(() => {
    try {
      localStorage.removeItem('tcf_dark_mode');
      document.documentElement.classList.remove('dark');
    } catch {}
  }, []);

  // Keep Neumorphism UI theme active
  useEffect(() => {
    document.documentElement.classList.add('theme-neumorphism', 'neu-theme');
  }, []);

  const displayName = userName || (user?.email ? user.email.split('@')[0] : 'Étudiant');

  // Navigation guard if in simulator
  const handleNav = (action: () => void) => {
    if (currentView === 'simulator') {
      const confirmLeave = window.confirm(
        t("Un examen est en cours. Êtes-vous sûr de vouloir quitter ? Vos réponses non soumises seront perdues.")
      );
      if (!confirmLeave) return;
    }
    action();
  };

  // Determine page title if not provided
  const resolvedTitle = title || (() => {
    switch (currentView) {
      case 'home':
        return t('Accueil');
      case 'dashboard':
        return t('Tableau de bord');
      case 'simulator':
        return t('Simulateur TCF Canada');
      case 'results':
        return t('Résultats de l\'épreuve');
      case 'feedback':
        return t('Feedback & Remerciements');
      default:
        return 'TCF Canada';
    }
  })();

  return (
    <div className="flex min-h-screen w-full bg-slate-50 text-slate-900">
      <div className="flex w-full bg-slate-50 text-slate-900 min-h-screen">
        {/* Collapsible Sidebar (Desktop) */}
        <nav
          className={`hidden lg:flex sticky top-0 h-screen shrink-0 border-r transition-all duration-300 ease-in-out ${
            sidebarOpen ? 'w-64' : 'w-16'
          } border-slate-200 bg-white p-2 shadow-xs flex flex-col justify-between z-30 select-none`}
        >
          <div>
            {/* Title / User Brand Section */}
            <div className="mb-4 border-b border-slate-200 pb-3">
              <div
                onClick={() => setShowProfileModal(true)}
                className="flex cursor-pointer items-center justify-between rounded-lg p-2 transition-colors hover:bg-slate-100"
                title={t('Mon Profil')}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid size-10 shrink-0 place-content-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-sm shadow-xs">
                    {isAdmin ? '👑' : displayName.charAt(0).toUpperCase()}
                  </div>
                  {sidebarOpen && (
                    <div className="min-w-0 truncate">
                      <span className="block text-sm font-bold text-slate-800 truncate">
                        {t(displayName)}
                      </span>
                      <span className="block text-xs text-slate-500 truncate">
                        {isAdmin ? t('👑 Administrateur') : t('Candidat TCF')}
                      </span>
                    </div>
                  )}
                </div>
                {sidebarOpen && (
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                )}
              </div>
            </div>

            {/* Main Navigation Items */}
            <div className="space-y-1 mb-6">
              <SidebarOption
                Icon={Home}
                title={t('Accueil')}
                isSelected={currentView === 'home'}
                onClick={() => handleNav(onNavigateHome)}
                open={sidebarOpen}
              />
              <SidebarOption
                Icon={BarChart3}
                title={t('Tableau de bord')}
                isSelected={currentView === 'dashboard' && !isMistakesTabActive}
                onClick={() => handleNav(onNavigateDashboard)}
                open={sidebarOpen}
              />
              <SidebarOption
                Icon={BookOpen}
                title={language === 'en' ? 'My Mistakes' : 'Mes Fautes'}
                isSelected={isMistakesTabActive}
                onClick={() => handleNav(onNavigateMistakes || onNavigateDashboard)}
                open={sidebarOpen}
              />
              {isAdmin && (
                <SidebarOption
                  Icon={Shield}
                  title={t('Administration')}
                  isSelected={currentView === 'dashboard' && !isMistakesTabActive}
                  onClick={() => handleNav(onNavigateDashboard)}
                  open={sidebarOpen}
                  badge="👑"
                />
              )}
            </div>

            {/* Account & Tools Section */}
            <div className="border-t border-slate-200 pt-3 space-y-1">
              {sidebarOpen && (
                <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {t('Compte & Aide')}
                </div>
              )}
              <SidebarOption
                Icon={User}
                title={t('Mon Profil')}
                isSelected={false}
                onClick={() => setShowProfileModal(true)}
                open={sidebarOpen}
              />
              <SidebarOption
                Icon={MessageSquare}
                title={t('Feedback')}
                isSelected={currentView === 'feedback'}
                onClick={() => handleNav(onNavigateFeedback)}
                open={sidebarOpen}
              />
              <SidebarOption
                Icon={LogOut}
                title={t('Déconnexion')}
                isSelected={false}
                onClick={() => handleNav(onSignOut)}
                open={sidebarOpen}
                isDestructive
              />
            </div>
          </div>

          {/* Toggle Expand / Collapse button */}
          <div className="border-t border-slate-200 pt-2">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex w-full items-center p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
              title={sidebarOpen ? t('Réduire le menu') : t('Agrandir le menu')}
            >
              <div className="grid size-8 place-content-center">
                <ChevronsRight
                  className={`h-4 w-4 transition-transform duration-300 ${
                    sidebarOpen ? "rotate-180" : ""
                  }`}
                />
              </div>
              {sidebarOpen && (
                <span className="text-xs font-semibold ml-2">
                  {t('Réduire le menu')}
                </span>
              )}
            </button>
          </div>
        </nav>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-auto">
          {/* Top Bar */}
          <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between shadow-2xs">
            <div className="min-w-0 pr-2 sm:pr-4 flex items-center gap-2">
              {/* Mobile Hamburger Menu Toggle */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-1.5 -ml-1 rounded-lg text-slate-700 hover:bg-slate-100 active:bg-slate-200 transition-colors cursor-pointer shrink-0"
                aria-label={t('Menu')}
                title={t('Ouvrir le menu')}
              >
                <Menu className="w-5 h-5 text-slate-700" />
              </button>

              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                <h1 className="text-sm sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-1.5 sm:gap-2 truncate">
                  <span className="w-2 h-2 rounded-full bg-blue-600 inline-block shrink-0"></span>
                  <span className="truncate">{resolvedTitle}</span>
                </h1>
                {isAdmin && (
                  <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[9px] sm:text-[10px] font-extrabold px-1.5 sm:px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                    {t('👑 Admin')}
                  </span>
                )}
                {combinationTitle && (
                  <span className="text-[10px] sm:text-xs font-medium text-slate-600 bg-slate-100 border border-slate-200 px-1.5 sm:px-2 py-0.5 rounded truncate max-w-[140px] sm:max-w-none">
                    {t(combinationTitle)}
                  </span>
                )}
              </div>
              {subtitle && (
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {t(subtitle)}
                </p>
              )}
            </div>

            {/* Right-side utilities */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Language Switcher */}
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setLanguage('fr')}
                  className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                    language === 'fr'
                      ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Passer en français"
                >
                  FR
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                    language === 'en'
                      ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Switch to English"
                >
                  EN
                </button>
              </div>

              {/* Quick Profile / CTA */}
              {onStartNewExam && currentView !== 'home' && currentView !== 'simulator' && (
                <button
                  type="button"
                  onClick={() => handleNav(onStartNewExam)}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-2xs cursor-pointer"
                >
                  <span>+</span>
                  <span>{t('Nouvel examen')}</span>
                </button>
              )}
            </div>
          </header>

          {/* Children View Content */}
          <main className={`flex-1 min-w-0 ${currentView !== 'simulator' ? 'pb-20 lg:pb-0' : ''}`}>
            {children}
          </main>
        </div>
      </div>

      {/* Mobile Slide-Over Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fadeIn"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Menu */}
          <div className="relative w-72 max-w-[82vw] bg-white h-full shadow-2xl flex flex-col justify-between p-4 z-10 select-none animate-slideInLeft border-r border-slate-200">
            <div>
              {/* Drawer User Header */}
              <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-200">
                <div
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setShowProfileModal(true);
                  }}
                  className="flex items-center gap-2.5 min-w-0 cursor-pointer"
                >
                  <div className="grid size-10 shrink-0 place-content-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-sm shadow-xs">
                    {isAdmin ? '👑' : displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 truncate">
                    <span className="block text-sm font-bold text-slate-800 truncate">
                      {t(displayName)}
                    </span>
                    <span className="block text-[11px] text-slate-500 truncate">
                      {isAdmin ? t('👑 Administrateur') : t('Candidat TCF')}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                  title={t('Fermer')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Main Nav Items */}
              <div className="space-y-1 mb-6">
                <SidebarOption
                  Icon={Home}
                  title={t('Accueil')}
                  isSelected={currentView === 'home'}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleNav(onNavigateHome);
                  }}
                  open={true}
                />
                <SidebarOption
                  Icon={BarChart3}
                  title={t('Tableau de bord')}
                  isSelected={currentView === 'dashboard' && !isMistakesTabActive}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleNav(onNavigateDashboard);
                  }}
                  open={true}
                />
                <SidebarOption
                  Icon={BookOpen}
                  title={language === 'en' ? 'My Mistakes' : 'Mes Fautes'}
                  isSelected={isMistakesTabActive}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleNav(onNavigateMistakes || onNavigateDashboard);
                  }}
                  open={true}
                />
                {isAdmin && (
                  <SidebarOption
                    Icon={Shield}
                    title={t('Administration')}
                    isSelected={currentView === 'dashboard' && !isMistakesTabActive}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleNav(onNavigateDashboard);
                    }}
                    open={true}
                    badge="👑"
                  />
                )}
              </div>

              {/* Account & Tools Section */}
              <div className="border-t border-slate-200 pt-3 space-y-1">
                <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {t('Compte & Aide')}
                </div>
                <SidebarOption
                  Icon={User}
                  title={t('Mon Profil')}
                  isSelected={false}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setShowProfileModal(true);
                  }}
                  open={true}
                />
                <SidebarOption
                  Icon={MessageSquare}
                  title={t('Feedback')}
                  isSelected={currentView === 'feedback'}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleNav(onNavigateFeedback);
                  }}
                  open={true}
                />
                <SidebarOption
                  Icon={LogOut}
                  title={t('Déconnexion')}
                  isSelected={false}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleNav(onSignOut);
                  }}
                  open={true}
                  isDestructive
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (Hidden in Simulator to prioritize writing space) */}
      {currentView !== 'simulator' && (
        <nav className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-1.5 flex items-center justify-around shadow-lg pb-[max(0.375rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => handleNav(onNavigateHome)}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
              currentView === 'home'
                ? 'text-blue-600'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Home className="w-5 h-5 mb-0.5" />
            <span>{t('Accueil')}</span>
          </button>

          <button
            type="button"
            onClick={() => handleNav(onNavigateDashboard)}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
              currentView === 'dashboard'
                ? 'text-blue-600'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-5 h-5 mb-0.5" />
            <span>{t('Dashboard')}</span>
          </button>

          {onStartNewExam && (
            <button
              type="button"
              onClick={() => handleNav(onStartNewExam)}
              className="flex flex-col items-center justify-center -mt-4 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white p-2.5 rounded-full shadow-md active:scale-95 transition-transform cursor-pointer"
              title={t('Commencer un examen')}
            >
              <span className="text-xl leading-none font-bold">+</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowProfileModal(true)}
            className="flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-bold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <User className="w-5 h-5 mb-0.5" />
            <span>{t('Profil')}</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-bold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <Menu className="w-5 h-5 mb-0.5" />
            <span>{t('Menu')}</span>
          </button>
        </nav>
      )}

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />

      {/* Device Recommendation Modal (Prompt for laptop/desktop on mobile/tab) */}
      <DeviceRecommendationModal />
    </div>
  );
};

interface SidebarOptionProps {
  Icon: LucideIcon;
  title: string;
  isSelected?: boolean;
  onClick: () => void;
  open: boolean;
  notifs?: number;
  badge?: string;
  isDestructive?: boolean;
}

const SidebarOption: React.FC<SidebarOptionProps> = ({
  Icon,
  title,
  isSelected = false,
  onClick,
  open,
  notifs,
  badge,
  isDestructive = false
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex h-11 w-full items-center rounded-lg transition-all duration-200 cursor-pointer ${
        isSelected
          ? "bg-blue-50 text-blue-700 font-bold shadow-2xs border-l-3 border-blue-600"
          : isDestructive
          ? "text-red-600 hover:bg-red-50 font-medium"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium"
      }`}
      title={open ? undefined : title}
    >
      <div className="grid h-full w-12 place-content-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>

      {open && (
        <span className="text-xs truncate transition-opacity duration-200 pr-2">
          {title}
        </span>
      )}

      {notifs !== undefined && open && (
        <span className="ml-auto mr-3 flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white font-bold">
          {notifs}
        </span>
      )}

      {badge && open && (
        <span className="ml-auto mr-3 text-xs">
          {badge}
        </span>
      )}
    </button>
  );
};
