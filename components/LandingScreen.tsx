
import React from 'react';
import { translations } from '../constants';

interface LandingScreenProps {
  onRegisterClick: () => void;
  onCaretakerLoginClick: () => void;
  onPatientLoginClick: () => void;
  onResetData: () => void;
  onExportData: () => void;
  hasData: boolean;
}

const LandingScreen: React.FC<LandingScreenProps> = ({ 
  onRegisterClick, 
  onCaretakerLoginClick,
  onPatientLoginClick,
  onResetData,
  onExportData,
  hasData
}) => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 to-indigo-600 p-4">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-2xl text-center">
        <div className="flex justify-center mb-6">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
            </svg>
        </div>
        
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">{translations.landingTitle}</h1>
        <p className="text-gray-500 mb-8">{translations.landingSubtitle}</p>

        {/* Primary Action: Register */}
        <div className="mb-6">
             <button
                onClick={onRegisterClick}
                className="w-full py-4 px-6 text-xl font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-lg transform transition hover:scale-105"
            >
                Register New Account
            </button>
        </div>

        <div className="relative flex py-5 items-center">
            <div className="flex-grow border-t border-gray-300"></div>
            <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">Or Login</span>
            <div className="flex-grow border-t border-gray-300"></div>
        </div>

        {/* Secondary Actions: Login */}
        <div className="grid grid-cols-2 gap-4">
             <button
                onClick={onCaretakerLoginClick}
                className="py-3 px-4 text-sm font-semibold text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 border border-blue-200 transition"
            >
                Caretaker Login
            </button>
             <button
                onClick={onPatientLoginClick}
                className="py-3 px-4 text-sm font-semibold text-green-700 bg-green-50 rounded-lg hover:bg-green-100 border border-green-200 transition"
            >
                Patient Login
            </button>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100 flex justify-center space-x-4">
             {hasData && (
                 <button onClick={onExportData} className="text-xs text-gray-400 hover:text-blue-500 hover:underline">
                    Copy Data
                 </button>
             )}
              <button onClick={onResetData} className="text-xs text-red-300 hover:text-red-500 hover:underline">
                Reset App
             </button>
        </div>
      </div>
    </div>
  );
};

export default LandingScreen;
