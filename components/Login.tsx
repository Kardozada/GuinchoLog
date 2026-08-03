import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { MOCK_ADMINS, MOCK_DRIVERS, MOCK_MECHANICS } from '../constants';
import { setCurrentUser } from '../services/storage';
import { Lock, User as UserIcon, LogIn } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [identifier, setIdentifier] = useState(''); // Can be Email or CPF
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.DRIVER);
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanIdentifier = identifier.trim().toLowerCase();
    const cleanCPF = identifier.replace(/\D/g, ''); // Remove non-digits for CPF check

    // Helper to validate password against the user's stored CPF
    const validatePassword = (user: User) => {
      if (!user.cpf) return false;
      const rawStoredCpf = user.cpf.replace(/\D/g, '');
      const expectedPassword = rawStoredCpf.substring(0, 6);
      return password === expectedPassword;
    };

    let userPool: User[] = [];
    if (selectedRole === UserRole.ADMIN) {
      userPool = MOCK_ADMINS;
    } else if (selectedRole === UserRole.DRIVER) {
      userPool = MOCK_DRIVERS;
    } else if (selectedRole === UserRole.MECHANIC) {
      userPool = MOCK_MECHANICS;
    }

    const user = userPool.find(u => 
      u.email.toLowerCase() === cleanIdentifier || 
      (u.cpf && u.cpf.replace(/\D/g, '') === cleanCPF)
    );

    if (user) {
      if (validatePassword(user)) {
        setCurrentUser(user);
        onLogin(user);
      } else {
        setError('Senha incorreta.');
      }
    } else {
      setError('Usuário não encontrado. Verifique seu CPF.');
    }
  };

  const toggleRole = (role: UserRole) => {
    setSelectedRole(role);
    setError('');
    setIdentifier('');
    setPassword('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1605218427306-022ba8c69a38?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-20"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/90 to-transparent"></div>
      
      <div className="relative z-10 w-full max-w-md p-8 bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">GuinchoLog</h1>
          <p className="text-blue-200">Acesso ao Sistema</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <div className="flex flex-wrap justify-center gap-2 mb-6">
               <button
                 type="button"
                 onClick={() => toggleRole(UserRole.DRIVER)}
                 className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedRole === UserRole.DRIVER ? 'bg-indigo-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
               >
                 Sou Motorista
               </button>
               <button
                 type="button"
                 onClick={() => toggleRole(UserRole.MECHANIC)}
                 className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedRole === UserRole.MECHANIC ? 'bg-indigo-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
               >
                 Sou Mecânico
               </button>
               <button
                 type="button"
                 onClick={() => toggleRole(UserRole.ADMIN)}
                 className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${selectedRole === UserRole.ADMIN ? 'bg-indigo-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
               >
                 Sou Administrador
               </button>
            </div>

            <label className="block text-sm font-medium text-gray-300 mb-2">
              CPF do {selectedRole === UserRole.ADMIN ? 'Admin' : selectedRole === UserRole.MECHANIC ? 'Mecânico' : 'Motorista'}
            </label>
            <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <UserIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-600 rounded-lg leading-5 bg-gray-800/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Digite seu CPF (apenas números)"
                required
              />
            </div>

            <label className="block text-sm font-medium text-gray-300 mb-2">
              Senha (6 primeiros dígitos do CPF)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-600 rounded-lg leading-5 bg-gray-800/50 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="******"
                required
                maxLength={6}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-indigo-500/30 transform hover:-translate-y-0.5"
          >
            <LogIn className="w-5 h-5" />
            Entrar
          </button>
        </form>
        
        <p className="mt-6 text-center text-gray-400 text-xs">
          Seu acesso deve estar cadastrado na base de usuários.
        </p>
      </div>
    </div>
  );
};

export default Login;
