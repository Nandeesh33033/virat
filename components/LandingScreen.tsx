
import React from 'react';
import { translations } from '../constants';

interface LandingScreenProps {
  onRegisterClick: () => void;
  onCaretakerLoginClick: () => void;
  onPatientLoginClick: () => void;
}

const LandingScreen: React.FC<LandingScreenProps> = ({ 
  onRegisterClick, 
  onCaretakerLoginClick,
  onPatientLoginClick,
}) => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-blue-600 p-4">
      <div className="w-full max-w-md p-10 bg-white rounded-3xl shadow-2xl text-center">
        
        {/* Icon Section */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
             </svg>
          </div>
        </div>
        
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">{translations.landingTitle}</h1>
        <p className="text-gray-500 text-sm mb-8">{translations.landingSubtitle}</p>

        {/* Primary Action: Register */}
        <div className="mb-6">
             <button
                onClick={onRegisterClick}
                className="w-full py-3.5 px-6 text-lg font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-md transition-colors duration-200"
            >
                Register New Account
            </button>
        </div>

        {/* Divider */}
        <div className="relative flex py-4 items-center mb-4">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink-0 mx-4 text-gray-400 text-xs uppercase tracking-wider">Or Login</span>
            <div className="flex-grow border-t border-gray-200"></div>
        </div>

        {/* Secondary Actions: Login */}
        <div className="grid grid-cols-2 gap-4">
             <button
                onClick={onCaretakerLoginClick}
                className="py-3 px-4 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 border border-gray-200 transition-colors duration-200"
            >
                Caretaker Login
            </button>
             <button
                onClick={onPatientLoginClick}
                className="py-3 px-4 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 border border-gray-200 transition-colors duration-200"
            >
                Patient Login
            </button>
        </div>
      </div>
    </div>
  );
};

export default LandingScreen;
