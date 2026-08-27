import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { User, UserRole } from '../types';
import { MOCK_DRIVERS } from '../constants';
import { fetchDrivers, saveDriver, deleteDriver, seedDriversIfEmpty } from '../services/storage';
import { Users, UserPlus, Search, Pencil, Trash2, X, Save, Eye, EyeOff, Loader2 } from 'lucide-react';

const roleLabel: Record<string, string> = {
  [UserRole.DRIVER]: 'Motorista',
  [UserRole.ADMIN]: 'Administrador',
  [UserRole.MECHANIC]: 'Mecânico',
};

// Senha efetiva: personalizada, ou os 6 primeiros dígitos do CPF.
const effectivePassword = (u: User): string => {
  if (u.password && u.password.length > 0) return u.password;
  const digits = (u.cpf || '').replace(/\D/g, '');
  return digits.substring(0, 6) || '—';
};

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?';

const DriverManagement: React.FC = () => {
  const [drivers, setDrivers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const [editing, setEditing] = useState<User | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadDrivers = async () => {
    setLoading(true);
    try {
      // Migração automática: se a coleção estiver vazia, semeia com a lista atual.
      const list = await seedDriversIfEmpty(MOCK_DRIVERS);
      setDrivers(list);
    } catch (e) {
      console.error('Erro ao carregar motoristas', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrivers();
  }, []);

  const toggleReveal = (id: string) => {
    setRevealed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openNew = () => {
    setEditing({ id: uuidv4(), name: '', email: '', cpf: '', role: UserRole.DRIVER, password: '' });
    setIsNew(true);
    setFormError('');
  };

  const openEdit = (d: User) => {
    setEditing({ ...d, password: d.password || '' });
    setIsNew(false);
    setFormError('');
  };

  const closeModal = () => {
    setEditing(null);
    setFormError('');
  };

  const handleSave = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    const cpf = (editing.cpf || '').trim();
    if (!name) { setFormError('Informe o nome do motorista.'); return; }
    if ((cpf.replace(/\D/g, '')).length < 6 && !(editing.password && editing.password.length > 0)) {
      setFormError('Informe o CPF (ou defina uma senha própria).');
      return;
    }

    const toSave: User = {
      ...editing,
      name,
      cpf,
      email: (editing.email || '').trim(),
      password: editing.password && editing.password.length > 0 ? editing.password : undefined,
      avatarUrl: editing.avatarUrl ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
    };

    setSaving(true);
    try {
      await saveDriver(toSave);
      closeModal();
      await loadDrivers();
    } catch (e) {
      setFormError('Não foi possível salvar. Verifique a conexão e tente de novo.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (d: User) => {
    if (!window.confirm(`Remover o motorista "${d.name}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteDriver(d.id);
      await loadDrivers();
    } catch (e) {
      alert('Não foi possível remover. Verifique a conexão e tente de novo.');
    }
  };

  const term = search.trim().toLowerCase();
  const filtered = term
    ? drivers.filter(d =>
        d.name.toLowerCase().includes(term) ||
        (d.cpf || '').replace(/\D/g, '').includes(term.replace(/\D/g, '')) ||
        (d.email || '').toLowerCase().includes(term))
    : drivers;

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Gestão de Motoristas
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? 'Carregando...' : `${drivers.length} motorista${drivers.length !== 1 ? 's' : ''} cadastrado${drivers.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-1 justify-end">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 flex-1 max-w-xs">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome ou CPF..."
              className="bg-transparent outline-none text-sm text-gray-700 w-full"
            />
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Novo Motorista</span>
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-500 flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            Carregando motoristas...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            {term ? 'Nenhum motorista encontrado para a busca.' : 'Nenhum motorista cadastrado ainda.'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(d => (
              <div key={d.id} className="p-3 sm:p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 grid place-items-center font-bold text-xs flex-none">
                  {initials(d.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-gray-900 text-sm truncate">{d.name}</div>
                  <div className="text-xs text-gray-400 truncate">{d.email || 'sem e-mail'}</div>
                </div>
                <div className="hidden md:block text-sm text-gray-500 tabular-nums w-32 flex-none">{d.cpf || '—'}</div>
                <div className="hidden sm:flex items-center gap-2 w-28 flex-none">
                  <code className="text-xs bg-gray-50 border border-gray-200 rounded px-2 py-0.5 tracking-widest">
                    {revealed.has(d.id) ? effectivePassword(d) : '••••••'}
                  </code>
                  <button onClick={() => toggleReveal(d.id)} className="text-gray-400 hover:text-gray-600" title="Mostrar/ocultar senha">
                    {revealed.has(d.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center gap-1.5 flex-none">
                  <button onClick={() => openEdit(d)} className="w-8 h-8 grid place-items-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100" title="Editar">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(d)} className="w-8 h-8 grid place-items-center rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100" title="Remover">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal cadastro/edição */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-10 px-4 overflow-y-auto pb-10">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <b className="text-gray-900 font-bold">{isNew ? 'Novo Motorista' : 'Editar Motorista'}</b>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">Nome completo</label>
                <input
                  value={editing.name}
                  onChange={e => setEditing({ ...editing, name: e.target.value })}
                  className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  placeholder="Ex: João da Silva"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">CPF</label>
                  <input
                    value={editing.cpf || ''}
                    onChange={e => setEditing({ ...editing, cpf: e.target.value })}
                    className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    placeholder="000.000.000-00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1.5">Papel</label>
                  <select
                    value={editing.role}
                    onChange={e => setEditing({ ...editing, role: e.target.value as UserRole })}
                    className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value={UserRole.DRIVER}>{roleLabel[UserRole.DRIVER]}</option>
                    <option value={UserRole.ADMIN}>{roleLabel[UserRole.ADMIN]}</option>
                    <option value={UserRole.MECHANIC}>{roleLabel[UserRole.MECHANIC]}</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">E-mail</label>
                <input
                  value={editing.email || ''}
                  onChange={e => setEditing({ ...editing, email: e.target.value })}
                  className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  placeholder="email@exemplo.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">Senha</label>
                <input
                  value={editing.password || ''}
                  onChange={e => setEditing({ ...editing, password: e.target.value })}
                  className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  placeholder="Deixe em branco = 6 primeiros dígitos do CPF"
                />
                <p className="text-xs text-gray-400 mt-1.5">
                  Em branco, a senha será os 6 primeiros dígitos do CPF
                  {editing.cpf ? ` (${(editing.cpf || '').replace(/\D/g, '').substring(0, 6)})` : ''}.
                </p>
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
            </div>
            <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-2.5">
              <button onClick={closeModal} className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 font-medium text-sm hover:bg-gray-100">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm disabled:opacity-70">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverManagement;
