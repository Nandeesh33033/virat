
import React from 'react';
import { View, RegisteredUser } from '../types';
import { translations } from '../constants';

interface HeaderProps {
  onLogout: () => void;
  currentUser?: RegisteredUser | null;
  currentView?: View;
}

const Header: React.FC<HeaderProps> = ({ onLogout, currentUser, currentView }) => {
  return (
    <header className="bg-blue-600 text-white p-4 shadow-md">
      <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
           <h1 className="text-xl md:text-2xl font-bold">{translations.appTitle}</h1>
           {currentUser && (
               <div className="flex items-center space-x-2 text-sm text-blue-100 mt-1">
                  <span className={`px-2 py-0.5 rounded-full font-semibold ${currentView === View.Caretaker ? 'bg-blue-800' : 'bg-green-600'}`}>
                    {currentView === View.Caretaker ? 'Caretaker' : 'Patient'}
                  </span>
                  <span>| {currentView === View.Caretaker ? currentUser.caretakerPhone : currentUser.patientPhone}</span>
               </div>
           )}
        </div>
        
        <button
          onClick={onLogout}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium transition shadow-sm w-full md:w-auto"
        >
          {translations.logoutButton}
        </button>
      </div>
    </header>
  );
};

export default Header;
