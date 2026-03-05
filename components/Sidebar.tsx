import React, { useContext } from 'react';
import { AppView } from '../types';
import { AppContext } from '../App';

interface SidebarProps {
  currentView: AppView;
  setView: (view: AppView) => void;
}

const NavItem: React.FC<{
  view: AppView;
  currentView: AppView;
  setView: (view: AppView) => void;
  icon: string;
  label: string;
  isSidebarOpen: boolean;
}> = ({ view, currentView, setView, icon, label, isSidebarOpen }) => {
  const isActive = currentView === view;
  return (
    <button
      onClick={() => setView(view)}
      title={isSidebarOpen ? '' : label}
      className={`flex items-center w-full px-4 py-3 text-sm font-medium text-left rounded-lg transition-colors duration-200 ${
        isActive
          ? 'bg-indigo-600 text-white shadow-lg'
          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-100'
      } ${!isSidebarOpen ? 'justify-center' : ''}`}
    >
      <i className={`fas ${icon} w-6 h-6 text-center transition-all duration-300 ${isSidebarOpen ? 'mr-3' : 'mr-0'}`}></i>
      <span className={`flex-1 whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'opacity-100 max-w-full ml-0' : 'opacity-0 max-w-0 -ml-3'}`}>{label}</span>
    </button>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView }) => {
    const { isSidebarOpen, setIsSidebarOpen } = useContext(AppContext);

  return (
    <aside className={`hidden md:flex bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex-col p-4 shadow-md transition-all duration-300 ease-in-out ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
      <div className="flex items-center mb-8 overflow-hidden">
        <i className="fas fa-book-reader text-3xl text-indigo-600 flex-shrink-0"></i>
        <h1 className={`text-xl font-bold text-slate-800 dark:text-slate-100 ml-3 whitespace-nowrap transition-opacity duration-200 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`}>Diario AI</h1>
      </div>

      {/* Il contenitore di navigazione ora occupa lo spazio disponibile e centra verticalmente i suoi figli */}
      <nav className="flex-1 flex flex-col justify-between">
        <div className="space-y-4">
          <NavItem
            view={AppView.Lessons}
            currentView={currentView}
            setView={setView}
            icon="fa-microphone-alt"
            label="Lezioni"
            isSidebarOpen={isSidebarOpen}
          />
          <NavItem
            view={AppView.Calendar}
            currentView={currentView}
            setView={setView}
            icon="fa-calendar-alt"
            label="Calendario"
            isSidebarOpen={isSidebarOpen}
          />
          <NavItem
            view={AppView.StudyPlan}
            currentView={currentView}
            setView={setView}
            icon="fa-brain"
            label="Piano di Studio"
            isSidebarOpen={isSidebarOpen}
          />
          <NavItem
            view={AppView.Quiz}
            currentView={currentView}
            setView={setView}
            icon="fa-question-circle"
            label="Quiz"
            isSidebarOpen={isSidebarOpen}
          />
        </div>

        <div>
           <NavItem
              view={AppView.Settings}
              currentView={currentView}
              setView={setView}
              icon="fa-cog"
              label="Impostazioni"
              isSidebarOpen={isSidebarOpen}
              />
        </div>
      </nav>
      
      {/* Il footer ora contiene solo il pulsante di attivazione/disattivazione e la sua separazione */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
        <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-full flex items-center justify-center p-3 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title={isSidebarOpen ? 'Comprimi barra laterale' : 'Espandi barra laterale'}
        >
            <i className={`fas fa-chevron-left transform transition-transform duration-300 ${isSidebarOpen ? '' : 'rotate-180'}`}></i>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;