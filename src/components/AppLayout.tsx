import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { UserProfileModal } from './UserProfileModal';
import { DeviceRecommendationModal } from './DeviceRecommendationModal';
import {
  Home,
  BarChart3,
  BookOpen,
  AlertCircle,
  FileEdit,
  Shield,
  User,
  LogOut,
  MessageSquare,
  ChevronsRight,
  ChevronDown,
  Menu,
  X,
  LucideIcon,
  ClipboardList
} from 'lucide-react';

export type AppView = 'home' | 'dashboard' | 'simulator' | 'results' | 'feedback' | 'submissions';

interface AppLayoutProps {
  currentView: AppView;
  title?: string;
  subtitle?: string;
  combinationTitle?: string;
  onNavigateHome: () => void;
  onNavigateDashboard: () => void;
  onNavigateSubmissions?: (tab?: 'exams' | 'mistakes') => void;
  submissionsTab?: 'exams' | 'mistakes';
  onNavigateMistakes?: () => void;
  mistakesCount?: number;
  isMistakesTabActive?: boolean;
  onNavigateFeedback: () => void;
  onStartNewExam?: () => void;
  onSignOut: () => void;
  submissionsCount?: number;
  onNavigateAdmin?: () => void;
  isAdminTabActive?: boolean;
  inspectedUser?: { id?: string; email: string; displayName?: string } | null;
  onClearInspectedUser?: () => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentView,
  title,
  subtitle,
  combinationTitle,
  onNavigateHome,
  onNavigateDashboard,
  onNavigateSubmissions,
  submissionsTab,
  onNavigateMistakes,
  mistakesCount,
  isMistakesTabActive,
  onNavigateFeedback,
  onStartNewExam,
  onSignOut,
  submissionsCount = 0,
  onNavigateAdmin,
  isAdminTabActive = false,
  inspectedUser = null,
  onClearInspectedUser,
  children
}) => {
  const { user, userName, isAdmin } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Persist sidebar locked open state and support smooth hover expansion
  const [sidebarLockedOpen, setSidebarLockedOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    if (currentView === 'simulator') return false;
    const saved = localStorage.getItem('tcf_sidebar_open');
    if (saved !== null) return saved === 'true';
    return window.innerWidth >= 1024;
  });
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const sidebarOpen = sidebarLockedOpen || isHovered;

  useEffect(() => {
    localStorage.setItem('tcf_sidebar_open', String(sidebarLockedOpen));
  }, [sidebarLockedOpen]);

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
        return t('Sélecteur d\'Examens');
      case 'dashboard':
        return t('Tableau de bord');
      case 'submissions':
        return language === 'en' ? 'My Submissions' : 'Mes Soumissions';
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
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 overflow-hidden">
      {/* Collapsible Sidebar (Desktop) - Animated with Framer Motion */}
      <motion.nav
        className="hidden lg:flex h-screen shrink-0 border-r border-slate-200 bg-white p-2 shadow-xs flex-col justify-between z-30 select-none overflow-hidden"
        animate={{
          width: sidebarOpen ? 256 : 64,
        }}
        transition={{
          duration: 0.2,
          ease: "easeInOut",
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={(e) => {
          const related = e.relatedTarget as Node | null;
          if (related && (e.currentTarget as HTMLElement).contains(related)) return;
          setIsHovered(false);
        }}
      >
          <div>
            {/* Title / User Brand Section */}
            <div className="mb-4 border-b border-slate-200 pb-3">
              <div
                onClick={() => setShowProfileModal(true)}
                className={`flex cursor-pointer items-center rounded-xl transition-colors hover:bg-slate-100 ${
                  sidebarOpen ? 'p-2 justify-between' : 'py-1 px-0 justify-center'
                }`}
                title={t('Mon Profil')}
              >
                <div className={`flex items-center ${sidebarOpen ? 'gap-3 min-w-0' : 'justify-center w-full'}`}>
                  <div className="grid size-10 shrink-0 place-content-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-sm shadow-xs mx-auto">
                    {isAdmin ? '👑' : displayName.charAt(0).toUpperCase()}
                  </div>
                  <motion.div
                    animate={{
                      display: sidebarOpen ? "block" : "none",
                      opacity: sidebarOpen ? 1 : 0,
                    }}
                    transition={{ duration: 0.15 }}
                    className="min-w-0 truncate"
                  >
                    <span className="block text-sm font-bold text-slate-800 truncate">
                      {t(displayName)}
                    </span>
                    <span className="block text-xs text-slate-500 truncate">
                      {isAdmin ? t('👑 Administrateur') : t('Candidat TCF')}
                    </span>
                  </motion.div>
                </div>
                {sidebarOpen && (
                  <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                )}
              </div>
            </div>

            {/* Main Navigation Items */}
            <div className="space-y-1 mb-6">
              <SidebarOption
                Icon={BarChart3}
                title={t('Tableau de bord')}
                isSelected={currentView === 'dashboard' && !isAdminTabActive && !isMistakesTabActive}
                onClick={() => handleNav(onNavigateDashboard)}
                open={sidebarOpen}
              />
              <SidebarOption
                Icon={BookOpen}
                title={t('Sélecteur d\'Examens')}
                isSelected={currentView === 'home'}
                onClick={() => handleNav(onNavigateHome)}
                open={sidebarOpen}
              />
              <SidebarOption
                Icon={ClipboardList}
                title={language === 'en' ? 'My Submissions' : 'Mes Soumissions'}
                isSelected={currentView === 'submissions' && submissionsTab !== 'mistakes'}
                onClick={() => handleNav(() => (onNavigateSubmissions ? onNavigateSubmissions('exams') : onNavigateDashboard()))}
                open={sidebarOpen}
                badge={submissionsCount > 0 ? String(submissionsCount) : undefined}
              />
              <SidebarOption
                Icon={AlertCircle}
                title={language === 'en' ? 'My Mistakes' : 'Mes Fautes'}
                isSelected={(currentView === 'dashboard' && isMistakesTabActive) || (currentView === 'submissions' && submissionsTab === 'mistakes')}
                onClick={() => handleNav(() => (onNavigateSubmissions ? onNavigateSubmissions('mistakes') : (onNavigateMistakes ? onNavigateMistakes() : onNavigateDashboard())))}
                open={sidebarOpen}
                badge={mistakesCount && mistakesCount > 0 ? String(mistakesCount) : undefined}
              />
              {isAdmin && (
                <SidebarOption
                  Icon={Shield}
                  title={t('Administration')}
                  isSelected={isAdminTabActive}
                  onClick={() => handleNav(onNavigateAdmin || onNavigateDashboard)}
                  open={sidebarOpen}
                  badge="👑"
                />
              )}
            </div>

            {/* Account & Tools Section */}
            <div className="border-t border-slate-200 pt-3 space-y-1">
              <motion.div
                animate={{
                  display: sidebarOpen ? "block" : "none",
                  opacity: sidebarOpen ? 1 : 0,
                }}
                transition={{ duration: 0.15 }}
                className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider"
              >
                {t('Compte & Aide')}
              </motion.div>
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
                onClick={onSignOut}
                open={sidebarOpen}
                isDestructive
              />
            </div>
          </div>

          {/* Toggle Expand / Collapse button */}
          <div className="border-t border-slate-200 pt-2">
            <button
              type="button"
              onClick={() => setSidebarLockedOpen(!sidebarLockedOpen)}
              className="flex w-full items-center p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer group/toggle"
              title={sidebarLockedOpen ? t('Réduire le menu') : t('Agrandir le menu')}
            >
              <div className="grid size-8 place-content-center shrink-0">
                <ChevronsRight
                  className={`h-4 w-4 transition-transform duration-300 ${
                    sidebarOpen ? "rotate-180" : ""
                  }`}
                />
              </div>
              <motion.span
                animate={{
                  display: sidebarOpen ? "inline-block" : "none",
                  opacity: sidebarOpen ? 1 : 0,
                }}
                transition={{ duration: 0.15 }}
                className="text-xs font-semibold ml-2 group-hover/toggle:translate-x-1 transition-transform duration-150 whitespace-pre"
              >
                {t('Réduire le menu')}
              </motion.span>
            </button>
          </div>
        </motion.nav>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
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

              <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                <h1 className="text-base sm:text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5 truncate">
                  <img
                    src="./logo-icon.png"
                    alt="TCF Canada"
                    className="w-8 h-8 sm:w-10 sm:h-10 object-contain shrink-0 drop-shadow-2xs select-none"
                  />
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

              {/* Direct Logout Button in Header */}
              {onSignOut && currentView !== 'simulator' && (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-red-200 bg-red-50/70 hover:bg-red-100 text-red-600 font-bold text-xs transition-colors shadow-2xs cursor-pointer shrink-0"
                  title={t('Déconnexion')}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">{t('Déconnexion')}</span>
                </button>
              )}
            </div>
          </header>

          {/* Admin Inspection Mode Top Banner */}
          {inspectedUser && (
            <div className="bg-gradient-to-r from-amber-500/15 via-blue-500/15 to-indigo-500/15 border-b border-amber-300/60 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3 text-xs backdrop-blur-md sticky top-[57px] sm:top-[65px] z-15 shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                <div className="truncate">
                  <span className="font-extrabold text-amber-900 mr-1.5">👑 {t('Mode Inspection Administrateur')} :</span>
                  <span className="font-bold text-slate-900">{inspectedUser.displayName || inspectedUser.email}</span>
                  <span className="text-slate-500 ml-1.5 font-mono text-[11px] truncate">({inspectedUser.email})</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {onNavigateAdmin && (
                  <button
                    type="button"
                    onClick={onNavigateAdmin}
                    className="px-3 py-1 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                  >
                    {t('Changer de Candidat')}
                  </button>
                )}
                {onClearInspectedUser && (
                  <button
                    type="button"
                    onClick={onClearInspectedUser}
                    className="px-3 py-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
                  >
                    ✕ {t('Quitter')}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Children View Content */}
          <main className={`flex-1 min-w-0 ${currentView === 'simulator' ? 'h-full overflow-hidden' : 'pb-24 lg:pb-16'}`}>
            {children}
          </main>
        </div>

      {/* Mobile Slide-Over Drawer - Animated with Framer Motion */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Drawer Menu */}
            <motion.div
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={{
                duration: 0.3,
                ease: "easeInOut",
              }}
              className="relative w-72 max-w-[82vw] bg-white h-full shadow-2xl flex flex-col justify-between p-4 z-10 select-none border-r border-slate-200"
            >
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
                    Icon={BarChart3}
                    title={t('Tableau de bord')}
                    isSelected={currentView === 'dashboard' && !isAdminTabActive && !isMistakesTabActive}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleNav(onNavigateDashboard);
                    }}
                    open={true}
                  />
                  <SidebarOption
                    Icon={BookOpen}
                    title={t('Sélecteur d\'Examens')}
                    isSelected={currentView === 'home'}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleNav(onNavigateHome);
                    }}
                    open={true}
                  />
                  <SidebarOption
                    Icon={ClipboardList}
                    title={language === 'en' ? 'My Submissions' : 'Mes Soumissions'}
                    isSelected={currentView === 'submissions' && submissionsTab !== 'mistakes'}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleNav(() => (onNavigateSubmissions ? onNavigateSubmissions('exams') : onNavigateDashboard()));
                    }}
                    open={true}
                    badge={submissionsCount > 0 ? String(submissionsCount) : undefined}
                  />
                  <SidebarOption
                    Icon={AlertCircle}
                    title={language === 'en' ? 'My Mistakes' : 'Mes Fautes'}
                    isSelected={(currentView === 'dashboard' && isMistakesTabActive) || (currentView === 'submissions' && submissionsTab === 'mistakes')}
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleNav(() => (onNavigateSubmissions ? onNavigateSubmissions('mistakes') : (onNavigateMistakes ? onNavigateMistakes() : onNavigateDashboard())));
                    }}
                    open={true}
                    badge={mistakesCount && mistakesCount > 0 ? String(mistakesCount) : undefined}
                  />
                  {isAdmin && (
                    <SidebarOption
                      Icon={Shield}
                      title={t('Administration')}
                      isSelected={isAdminTabActive}
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleNav(onNavigateAdmin || onNavigateDashboard);
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navigation Bar (Hidden in Simulator to prioritize writing space) */}
      {currentView !== 'simulator' && (
        <nav className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-1.5 flex items-center justify-around shadow-lg pb-[max(0.375rem,env(safe-area-inset-bottom))]">
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

          <button
            type="button"
            onClick={() => handleNav(onNavigateHome)}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
              currentView === 'home'
                ? 'text-blue-600'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-5 h-5 mb-0.5" />
            <span>{t('Examens')}</span>
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
        onSignOut={onSignOut}
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
      className={`group/sidebar relative flex h-11 w-full items-center rounded-xl transition-all duration-150 cursor-pointer ${
        open ? 'px-2.5 justify-start' : 'justify-center px-0'
      } ${
        isSelected
          ? open
            ? "bg-blue-50 text-blue-700 font-bold shadow-2xs border-l-4 border-blue-600"
            : "bg-blue-100/90 text-blue-700 font-bold shadow-2xs border border-blue-300"
          : isDestructive
          ? "text-red-600 hover:bg-red-50 font-medium"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium"
      }`}
      title={open ? undefined : title}
    >
      <div className={`grid h-full place-content-center shrink-0 ${open ? 'w-8' : 'w-full'} transition-transform duration-150 group-hover/sidebar:scale-105`}>
        <Icon className="h-5 w-5" />
      </div>

      <motion.span
        animate={{
          display: open ? 'inline-block' : 'none',
          opacity: open ? 1 : 0,
        }}
        transition={{ duration: 0.15 }}
        className="text-xs truncate transition-transform duration-150 group-hover/sidebar:translate-x-1 whitespace-pre inline-block pr-2"
      >
        {title}
      </motion.span>

      {notifs !== undefined && open && (
        <motion.span
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="ml-auto mr-2 flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white font-bold"
        >
          {notifs}
        </motion.span>
      )}

      {badge && open && (
        <span className="ml-auto mr-2 text-xs">
          {badge}
        </span>
      )}
    </button>
  );
};
