import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import DriverForm from './components/DriverForm';
import AdminDashboard from './components/AdminDashboard';
import { User, UserRole } from './types';
import { getCurrentUser, setCurrentUser } from './services/storage';
import { LogOut, LayoutDashboard, FilePlus, Type, Minus, Plus } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  
  // Estado para controle do tamanho da fonte (Percentual, padrão 100%)
  const [fontScale, setFontScale] = useState(() => {
    const saved = localStorage.getItem('guincholog_font_scale');
    return saved ? Number(saved) : 100;
  });

  // Efeito para aplicar o tamanho da fonte ao elemento raiz (HTML)
  useEffect(() => {
    // O padrão dos navegadores é 16px. 100% = 16px.
    // O Tailwind usa 'rem', então alterar o root afeta todo o app.
    document.documentElement.style.fontSize = `${fontScale}%`;
  }, [fontScale]);

  const adjustFontSize = (increment: number) => {
    setFontScale(prev => {
      const newVal = prev + increment;
      // Limita entre 80% (pequeno) e 130% (grande)
      const clamped = Math.min(Math.max(newVal, 80), 130); 
      localStorage.setItem('guincholog_font_scale', clamped.toString());
      return clamped;
    });
  };

  useEffect(() => {
    const storedUser = getCurrentUser();
    if (storedUser) {
      setUser(storedUser);
    }
  }, []);

  const handleLogin = (newUser: User) => {
    setUser(newUser);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setUser(null);
  };

  const handleDriverSuccess = () => {
    console.log("Formulário resetado com sucesso.");
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
       <div className="min-h-screen flex flex-col">
          {/* Navigation Bar */}
          <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
             <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                   <div className="flex items-center gap-3">
                      <div className="bg-indigo-600 p-2 rounded-lg">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                      </div>
                      <div>
                        <span className="font-bold text-xl tracking-tight text-gray-900">GuinchoLog</span>
                        <span className="text-xs block text-gray-500 -mt-1">{user.role === UserRole.ADMIN ? 'Painel Administrativo' : 'Portal do Motorista'}</span>
                      </div>
                   </div>
                   
                   <div className="flex items-center gap-2 md:gap-4">
                      {/* Font Size Controls */}
                      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 mr-1 border border-gray-200">
                         <button 
                           onClick={() => adjustFontSize(-5)} 
                           className="p-1.5 hover:bg-white rounded shadow-sm transition-all text-gray-600 active:scale-95" 
                           title="Diminuir Fonte"
                         >
                            <Minus className="w-3 h-3 md:w-4 md:h-4" />
                         </button>
                         <Type className="w-3 h-3 md:w-4 md:h-4 text-gray-400 mx-1" />
                         <button 
                           onClick={() => adjustFontSize(5)} 
                           className="p-1.5 hover:bg-white rounded shadow-sm transition-all text-gray-600 active:scale-95" 
                           title="Aumentar Fonte"
                         >
                            <Plus className="w-3 h-3 md:w-4 md:h-4" />
                         </button>
                      </div>

                      <div className="hidden md:flex flex-col items-end mr-2">
                         <span className="text-sm font-medium text-gray-900">{user.name}</span>
                         <span className="text-xs text-gray-500">{user.email}</span>
                      </div>
                      <img src={user.avatarUrl} alt="Avatar" className="w-10 h-10 rounded-full border-2 border-indigo-100" />
                      <button 
                        onClick={handleLogout}
                        className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-full hover:bg-gray-100"
                        title="Sair"
                      >
                         <LogOut className="w-5 h-5" />
                      </button>
                   </div>
                </div>
             </div>
          </nav>

          {/* Main Content Area */}
          <main className="flex-1 bg-gray-50 pt-8 px-4 sm:px-6 lg:px-8">
             {user.role === UserRole.ADMIN ? (
               <AdminDashboard />
             ) : (
               <DriverForm user={user} onSuccess={handleDriverSuccess} />
             )}
          </main>
       </div>
    </Router>
  );
};

export default App;