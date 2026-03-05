import React from 'react';
import { AppView } from '../types';

interface BottomNavBarProps {
  currentView: AppView;
  setView: (view: AppView) => void;
}

const NavItem: React.FC<{
  view: AppView;
  currentView: AppView;
  setView: (view: AppView) => void;
  icon: string;
  label: string;
}> = ({ view, currentView, setView, icon, label }) => {
  const isActive = currentView === view;
  return (
    <button
      onClick={() => setView(view)}
      className={`flex flex-col items-center justify-center w-full pt-2 pb-1 text-xs transition-colors duration-200 ${
        isActive
          ? 'text-indigo-600 dark:text-indigo-400'
          : 'text-slate-500 dark:text-slate-400 hover:text-indigo-500 dark:hover:text-indigo-300'
      }`}
      aria-label={label}
    >
      <i className={`fas ${icon} text-xl mb-1`}></i>
      <span>{label}</span>
    </button>
  );
};


const BottomNavBar: React.FC<BottomNavBarProps> = ({ currentView, setView }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-around items-center shadow-top z-40 md:hidden">
        <NavItem view={AppView.Lessons} currentView={currentView} setView={setView} icon="fa-microphone-alt" label="Lezioni" />
        <NavItem view={AppView.Calendar} currentView={currentView} setView={setView} icon="fa-calendar-alt" label="Calendario" />
        <NavItem view={AppView.StudyPlan} currentView={currentView} setView={setView} icon="fa-brain" label="Piano Studio" />
        <NavItem view={AppView.Quiz} currentView={currentView} setView={setView} icon="fa-question-circle" label="Quiz" />
        <NavItem view={AppView.Settings} currentView={currentView} setView={setView} icon="fa-cog" label="Impostazioni" />
    </nav>
  );
};

export default BottomNavBar;