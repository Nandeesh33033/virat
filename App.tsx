
import React, { useState, useEffect, useCallback } from 'react';
import { Medicine, Log, View, RegisteredUser } from './types';
import { initialMedicines, initialLogs, translations } from './constants';
import CaretakerView from './components/CaretakerView';
import PatientView from './components/PatientView';
import ReminderModal from './components/ReminderModal';
import Header from './components/Header';
import LandingScreen from './components/LandingScreen';
import RegisterScreen from './components/RegisterScreen';
import LoginChoiceScreen from './components/LoginChoiceScreen';
import CaretakerLoginScreen from './components/CaretakerLoginScreen';
import PatientLoginScreen from './components/PatientLoginScreen';

// --- CONFIGURATION ---
// FAST2SMS API KEY
const FAST2SMS_API_KEY = 'tJE8T3LG0yQIRDdNgFaKloxeZ9rXqsmiO5bMcY7Sj4hHpCvA2zHLnNZyDTIuS7c1Y4MgJklifRd3ebB9';

const App: React.FC = () => {
  // --- STATE WITH PERSISTENCE (V5 Keys to Wipe Old Data/Twilio Config) ---
  
  // 1. ALL USERS (Database Simulation)
  const [allUsers, setAllUsers] = useState<RegisteredUser[]>(() => {
    const saved = localStorage.getItem('users_v5');
    if (saved) {
        return JSON.parse(saved);
    }
    return [];
  });

  // 2. ACTIVE SESSION
  const [currentUser, setCurrentUser] = useState<RegisteredUser | null>(() => {
    const saved = localStorage.getItem('currentUser_v5');
    return saved ? JSON.parse(saved) : null;
  });

  // 3. ALL MEDICINES
  const [allMedicines, setAllMedicines] = useState<Medicine[]>(() => {
    const saved = localStorage.getItem('medicines_v5');
    return saved ? JSON.parse(saved) : initialMedicines;
  });

  // 4. ALL LOGS
  const [allLogs, setAllLogs] = useState<Log[]>(() => {
     const saved = localStorage.getItem('logs_v5');
     if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((l: any) => ({ ...l, timestamp: new Date(l.timestamp) }));
     }
     return initialLogs;
  });

  const [currentView, setCurrentView] = useState<View>(View.Landing);
  const [activeReminder, setActiveReminder] = useState<Medicine | null>(null);
  
  const isLoggedIn = !!currentUser;
  
  // Persist SMS timestamps to avoid duplicate sending on refresh
  const [lastSmsTime, setLastSmsTime] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('lastSmsTime_v5');
    return saved ? JSON.parse(saved) : {};
  });

  // --- PERSISTENCE EFFECTS ---
  useEffect(() => {
    localStorage.setItem('users_v5', JSON.stringify(allUsers));
  }, [allUsers]);

  useEffect(() => {
    if (currentUser) {
        localStorage.setItem('currentUser_v5', JSON.stringify(currentUser));
    } else {
        localStorage.removeItem('currentUser_v5');
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('medicines_v5', JSON.stringify(allMedicines));
  }, [allMedicines]);

  useEffect(() => {
    localStorage.setItem('logs_v5', JSON.stringify(allLogs));
  }, [allLogs]);

  useEffect(() => {
    localStorage.setItem('lastSmsTime_v5', JSON.stringify(lastSmsTime));
  }, [lastSmsTime]);

  // --- HELPER FUNCTIONS ---
  const formatTime12Hour = (time24: string) => {
    if (!time24) return '';
    const [h, m] = time24.split(':');
    let hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${m} ${ampm}`;
  };

  // --- DERIVED STATE ---
  const userMedicines = currentUser 
    ? allMedicines.filter(m => m.caretakerId === currentUser.caretakerPhone)
    : [];

  const userLogs = currentUser
    ? allLogs.filter(l => l.caretakerId === currentUser.caretakerPhone)
    : [];

  const addMedicine = (med: Omit<Medicine, 'id' | 'caretakerId'>) => {
    if (!currentUser) return;
    const newMed: Medicine = { 
        ...med, 
        id: Date.now().toString(),
        caretakerId: currentUser.caretakerPhone 
    };
    setAllMedicines(prev => [...prev, newMed].sort((a,b) => a.schedule.time.localeCompare(b.schedule.time)));
  };

  const addLog = (medicineId: string, status: 'taken' | 'missed', ownerId?: string) => {
    const cid = ownerId || currentUser?.caretakerPhone;
    if (!cid) return;

    const newLog: Log = {
      id: Date.now().toString(),
      medicineId,
      caretakerId: cid,
      timestamp: new Date(),
      status,
    };
    setAllLogs(prev => [...prev, newLog]);
    setActiveReminder(null);
  };
  
  const sendSmsViaApi = async (phone: string, message: string): Promise<{ success: boolean; error?: string }> => {
    if (!phone) return { success: false, error: 'Missing Phone' };
    
    // Fast2SMS requires just the 10 digit number usually
    let formattedPhone = phone.replace(/[^\d]/g, '');
    if (formattedPhone.length > 10) {
        formattedPhone = formattedPhone.slice(-10);
    }

    // Fast2SMS URL - Route Q (Quick)
    // IMPORTANT: Message is encoded and special chars are minimized in the caller function
    const fast2smsUrl = `https://www.fast2sms.com/dev/bulkV2?authorization=${FAST2SMS_API_KEY}&route=q&message=${encodeURIComponent(message)}&language=english&flash=0&numbers=${formattedPhone}`;

    // Proxy List
    const proxies = [
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(fast2smsUrl)}`,
        `https://corsproxy.io/?${encodeURIComponent(fast2smsUrl)}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(fast2smsUrl)}`
    ];

    let lastError = '';

    // 1. Try Proxies
    for (const proxyUrl of proxies) {
        try {
            console.log(`Attempting SMS via proxy: ${proxyUrl}`);
            const response = await fetch(proxyUrl, { method: 'GET' });
            
            // Fast2SMS returns JSON
            const data = await response.json();
            console.log("Fast2SMS Response:", data);

            if (data.return === true) {
                return { success: true };
            } else {
                lastError = data.message || "Fast2SMS API Error";
                // If it's a DLT error, no point trying other proxies
                if (lastError.includes("DLT") || lastError.includes("blocked")) {
                     return { success: false, error: lastError };
                }
            }
        } catch (error: any) {
            console.error("Proxy Error:", error);
            lastError = error.message;
        }
    }

    // 2. Fallback: No-CORS (Fire and Forget)
    try {
        console.log("Proxies failed. Attempting no-cors mode...");
        await fetch(fast2smsUrl, { mode: 'no-cors' });
        console.log("No-cors request sent.");
        return { success: true }; 
    } catch (e: any) {
        return { success: false, error: lastError || "Network Blocked" };
    }
  };

  const handleReminderTimeout = async () => {
    if (activeReminder) {
      const medicineOwner = allUsers.find(u => u.caretakerPhone === activeReminder.caretakerId);
      const cPhone = medicineOwner?.caretakerPhone;

      if (cPhone) {
        const foodInstruction = activeReminder.beforeFood ? 'BEFORE' : 'AFTER';
        const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
        
        // Simplified Message for Caretaker (No special chars)
        const messageContent = `ALERT Patient MISSED medicine ${activeReminder.name} ${activeReminder.dosage}mg Quantity ${activeReminder.pills} pills ${foodInstruction} food at ${formatTime12Hour(activeReminder.schedule.time)} ${timestamp}`;
        
        const result = await sendSmsViaApi(cPhone, messageContent);
        if (!result.success) {
            console.error("Missed Dose SMS Failed:", result.error);
            alert(`Failed to send alert to Caretaker. Reason: ${result.error}`);
        }
      }
      addLog(activeReminder.id, 'missed', activeReminder.caretakerId);
    }
  };

  // --- AUTHENTICATION HANDLERS ---

  const handleRegister = (cPhone: string, pPhone: string, password: string, faceImage: string, faceDescriptor: number[]) => {
    if (allUsers.some(u => u.caretakerPhone === cPhone)) {
        alert("An account with this Caretaker Phone Number already exists.");
        return;
    }

    const newUser: RegisteredUser = {
      caretakerPhone: cPhone,
      patientPhone: pPhone,
      password: password,
      faceImage: faceImage,
      faceDescriptor: faceDescriptor 
    };

    setAllUsers(prev => [...prev, newUser]);
    alert("Registration Successful! Please login.");
    setCurrentView(View.Landing);
  };

  const handleCaretakerLogin = (phone: string, password: string) => {
    const user = allUsers.find(u => u.caretakerPhone === phone);
    if (!user) {
        alert("No account found with this Caretaker Phone Number.");
        return;
    }
    if (password === user.password) {
        setCurrentUser(user);
        setCurrentView(View.Caretaker);
    } else {
        alert(translations.incorrectPasswordError);
    }
  };

  const handlePatientLogin = (matchedUserPhone: string) => {
     const user = allUsers.find(u => u.patientPhone === matchedUserPhone);
     if (!user) {
        alert("Authentication Error: User not found.");
        return;
    }
    setCurrentUser(user);
    setCurrentView(View.Patient);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentView(View.Landing);
  };

  const sendReminderSMS = async (medicine: Medicine, manualTrigger: boolean = false) => {
    const owner = allUsers.find(u => u.caretakerPhone === medicine.caretakerId);
    const targetPhone = owner?.patientPhone;

    if (!targetPhone) {
      if (manualTrigger) alert("Error: No patient phone number found.");
      return;
    }
    
    const now = Date.now();
    if (!manualTrigger && lastSmsTime[medicine.id] && now - lastSmsTime[medicine.id] < 120000) {
      return;
    }
    
    setLastSmsTime(prev => ({ ...prev, [medicine.id]: now }));
    const foodInstruction = medicine.beforeFood ? 'BEFORE' : 'AFTER';
    
    // Simplified Patient Reminder Format (No brackets/newlines)
    // Example: MediRemind Take 1 pill of Dolo 650mg AFTER food at 09:00 AM
    const messageContent = `MediRemind Take ${medicine.pills} pills of ${medicine.name} ${medicine.dosage}mg ${foodInstruction} food at ${formatTime12Hour(medicine.schedule.time)}`;
    
    const result = await sendSmsViaApi(targetPhone, messageContent);
    
    if (manualTrigger) {
        if (result.success) {
            alert("SMS Sent Successfully!");
        } else {
            alert("SMS Failed: " + result.error);
        }
    } else if (!result.success) {
        console.warn("Automated SMS failed:", result.error);
        // Alert user on screen if automated SMS fails so they know logic triggered but network failed
        alert(`Warning: Failed to send SMS for ${medicine.name}. Reason: ${result.error || 'Network Blocked'}`);
    }
  };

  const checkReminders = useCallback(() => {
    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' });
    const currentTimeStr = now.toTimeString().substring(0, 5); 
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const medsToCheck = allMedicines;

    for (const med of medsToCheck) {
      if (!med.schedule.day.includes(currentDay)) continue;

      const [schedH, schedM] = med.schedule.time.split(':').map(Number);
      const schedMinutes = schedH * 60 + schedM;
      const diff = currentMinutes - schedMinutes;

      // Smart Reminder: Show if opened within 30 mins
      if (diff >= 0 && diff <= 30) {
        const takenToday = allLogs.some(log => 
          log.medicineId === med.id && 
          log.timestamp.toDateString() === now.toDateString() &&
          log.status === 'taken'
        );
        
        const missedToday = allLogs.some(log =>
            log.medicineId === med.id &&
            log.timestamp.toDateString() === now.toDateString() &&
            log.status === 'missed'
        );

        if (!takenToday && !missedToday) {
           // Only update modal if one isn't already active to avoid flickering, 
           // OR if the current time matches exactly (priority)
           if (!activeReminder || med.schedule.time === currentTimeStr) {
               setActiveReminder(med);
           }
           
           // Send SMS trigger
           if (med.schedule.time === currentTimeStr) {
               sendReminderSMS(med, false); 
           }
        }
      }
    }
  }, [allMedicines, allLogs, activeReminder, lastSmsTime, allUsers]); 

  useEffect(() => {
    if (allMedicines.length > 0) {
        const interval = setInterval(checkReminders, 1000);
        return () => clearInterval(interval);
    }
  }, [checkReminders, allMedicines]);


  const renderActiveReminder = () => {
    if (activeReminder) {
        return (
            <ReminderModal 
              medicine={activeReminder} 
              onTaken={() => addLog(activeReminder.id, 'taken', activeReminder.caretakerId)}
              onTimeout={handleReminderTimeout}
            />
        );
    }
    return null;
  };

  if (!isLoggedIn) {
      return (
        <>
            {renderActiveReminder()}
            {(() => {
                switch (currentView) {
                    case View.Landing:
                        return <LandingScreen 
                            onRegisterClick={() => setCurrentView(View.Register)}
                            onLoginClick={() => setCurrentView(View.LoginChoice)}
                        />;
                    case View.Register:
                        return <RegisterScreen 
                            onRegister={handleRegister} 
                            onBack={() => setCurrentView(View.Landing)}
                        />;
                    case View.LoginChoice:
                        return <LoginChoiceScreen
                            onCaretakerSelect={() => setCurrentView(View.LoginCaretaker)}
                            onPatientSelect={() => setCurrentView(View.LoginPatient)}
                            onBack={() => setCurrentView(View.Landing)}
                        />;
                    case View.LoginCaretaker:
                        return <CaretakerLoginScreen 
                            onLogin={handleCaretakerLogin}
                            onBack={() => setCurrentView(View.LoginChoice)}
                        />;
                    case View.LoginPatient:
                        return <PatientLoginScreen 
                            onSuccess={handlePatientLogin}
                            onBack={() => setCurrentView(View.LoginChoice)}
                            registeredUsers={allUsers}
                        />;
                    default:
                        return <LandingScreen onRegisterClick={() => setCurrentView(View.Register)} onLoginClick={() => setCurrentView(View.LoginChoice)} />;
                }
            })()}
        </>
      );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header onLogout={handleLogout} />
      <main className="flex-grow p-4">
        {currentView === View.Caretaker ? (
          <CaretakerView 
            medicines={userMedicines} 
            addMedicine={addMedicine} 
            logs={userLogs} 
          />
        ) : (
          <PatientView medicines={userMedicines} logs={userLogs} />
        )}
      </main>
      {renderActiveReminder()}
    </div>
  );
};

export default App;
