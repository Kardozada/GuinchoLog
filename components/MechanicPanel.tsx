import React, { useState, useEffect } from 'react';
import { User, MaintenanceRecord } from '../types';
import { VEHICLES, TIPOS_MANUTENCAO, getLocalDate } from '../constants';
import { saveMaintenanceRecord, fetchMaintenanceRecords, deleteMaintenanceRecord } from '../services/storage';
import { Wrench, Calendar, Loader2, CheckCircle, Save, Edit2, Trash2, AlertTriangle, AlertCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface MechanicPanelProps {
  user: User;
}

const MechanicPanel: React.FC<MechanicPanelProps> = ({ user }) => {
  const [date, setDate] = useState(getLocalDate());
  const [vehicleId, setVehicleId] = useState('');
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState<number | ''>('');
  const [odometer, setOdometer] = useState<number | ''>('');
  const [nextOdometer, setNextOdometer] = useState<number | ''>('');
  const [nextDate, setNextDate] = useState('');

  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    setIsLoading(true);
    const data = await fetchMaintenanceRecords();
    setRecords(data);
    setIsLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId || !type || !description || !cost || !odometer) {
      alert('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setIsSubmitting(true);

    const record: MaintenanceRecord = {
      id: editingId || uuidv4(),
      vehicleId,
      date,
      type,
      description,
      cost: Number(cost),
      odometer: Number(odometer),
      nextOdometer: nextOdometer ? Number(nextOdometer) : undefined,
      nextDate: nextDate || undefined,
      mechanicId: user.id,
      mechanicName: user.name,
      createdAt: new Date().toISOString()
    };

    try {
      await saveMaintenanceRecord(record);
      await loadRecords();
      resetForm();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar manutenção.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (record: MaintenanceRecord) => {
    setEditingId(record.id);
    setDate(record.date);
    setVehicleId(record.vehicleId);
    setType(record.type);
    setDescription(record.description);
    setCost(record.cost);
    setOdometer(record.odometer);
    setNextOdometer(record.nextOdometer || '');
    setNextDate(record.nextDate || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este registro?')) return;
    try {
      await deleteMaintenanceRecord(id);
      await loadRecords();
    } catch (error) {
      console.error('Erro ao deletar:', error);
      alert('Erro ao excluir manutenção.');
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setDate(getLocalDate());
    setVehicleId('');
    setType('');
    setDescription('');
    setCost('');
    setOdometer('');
    setNextOdometer('');
    setNextDate('');
  };

  // Reminders calculation
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next7Days = new Date(today);
  next7Days.setDate(today.getDate() + 7);

  const getReminders = () => {
    const reminders = [];
    
    for (const record of records) {
      if (record.nextDate) {
        const d = new Date(record.nextDate + 'T12:00:00');
        d.setHours(0, 0, 0, 0);
        
        if (d < today) {
          reminders.push({ ...record, status: 'VENCIDA' });
        } else if (d <= next7Days) {
          reminders.push({ ...record, status: 'PRÓXIMA' });
        }
      }
    }
    
    return reminders.sort((a, b) => {
      if (a.status === 'VENCIDA' && b.status === 'PRÓXIMA') return -1;
      if (a.status === 'PRÓXIMA' && b.status === 'VENCIDA') return 1;
      return new Date(a.nextDate!).getTime() - new Date(b.nextDate!).getTime();
    });
  };

  const reminders = getReminders();

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Lembretes */}
      {reminders.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
          <div className="p-4 bg-red-50 border-b border-red-100 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h2 className="text-md font-bold text-red-900">Avisos de Manutenção</h2>
          </div>
          <div className="p-4 divide-y divide-gray-100">
            {reminders.map(r => {
              const vehicle = VEHICLES.find(v => v.id === r.vehicleId);
              return (
                <div key={`reminder-${r.id}`} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-900">{vehicle?.name || r.vehicleId} - {r.type}</span>
                    <span className="text-sm text-gray-600">Última troca: {new Date(r.date + 'T12:00:00').toLocaleDateString('pt-BR')} (KM: {r.odometer})</span>
                    <span className="text-sm text-gray-600">Próxima: {new Date(r.nextDate + 'T12:00:00').toLocaleDateString('pt-BR')} {r.nextOdometer ? `(ou KM ${r.nextOdometer})` : ''}</span>
                  </div>
                  <div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${r.status === 'VENCIDA' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {r.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Formulário */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 sm:p-6 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wrench className="w-6 h-6 text-indigo-600" />
            <h2 className="text-lg font-bold text-gray-900">
              {editingId ? 'Editar Manutenção' : 'Nova Manutenção'}
            </h2>
          </div>
          {editingId && (
             <button onClick={resetForm} className="text-sm text-indigo-600 font-medium hover:underline">
               Cancelar edição
             </button>
          )}
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Veículo *</label>
              <select
                required
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Selecione o veículo...</option>
                {VEHICLES.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Serviço *</label>
              <select
                required
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Selecione o tipo...</option>
                {TIPOS_MANUTENCAO.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição do Serviço *</label>
              <textarea
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Detalhes das peças e serviços..."
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Custo Total (R$) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={cost}
                onChange={(e) => setCost(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Ex: 850.00"
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Odômetro / KM *</label>
              <input
                type="number"
                required
                value={odometer}
                onChange={(e) => setOdometer(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Ex: 154000"
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="hidden lg:block"></div> {/* Spacer */}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                Próxima Manut. (KM)
                <span title="Para gerar lembrete">
                  <AlertCircle className="w-3 h-3 text-gray-400" />
                </span>
              </label>
              <input
                type="number"
                value={nextOdometer}
                onChange={(e) => setNextOdometer(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="Opcional"
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                Próxima Manut. (Data)
                <span title="Para gerar lembrete">
                  <AlertCircle className="w-3 h-3 text-gray-400" />
                </span>
              </label>
              <input
                type="date"
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  {editingId ? 'Atualizar Manutenção' : 'Salvar Manutenção'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {showSuccess && (
        <div className="bg-green-50 text-green-800 p-4 rounded-lg flex items-center gap-3 animate-fade-in border border-green-200">
          <CheckCircle className="w-5 h-5 text-green-500" />
          <p className="font-medium">Registro salvo com sucesso!</p>
        </div>
      )}

      {/* Histórico */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 sm:p-6 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-gray-600" />
            <h2 className="text-lg font-bold text-gray-900">Histórico de Manutenções</h2>
          </div>
          <span className="bg-gray-200 text-gray-700 text-xs font-bold px-2 py-1 rounded-full">
            {records.length}
          </span>
        </div>
        
        <div className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : records.length === 0 ? (
            <div className="p-8 text-center text-gray-500 flex flex-col items-center">
              <Wrench className="w-12 h-12 mb-3 text-gray-300" />
              <p>Nenhuma manutenção registrada ainda.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {records.map(record => {
                const vehicle = VEHICLES.find(v => v.id === record.vehicleId);
                return (
                  <div key={record.id} className="p-4 sm:p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900">
                            {new Date(record.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </span>
                          <span className="text-gray-300">•</span>
                          <span className="text-indigo-600 font-semibold">{vehicle?.name || record.vehicleId}</span>
                          <span className="text-gray-300">•</span>
                          <span className="text-gray-700 font-medium">{record.type}</span>
                        </div>
                        
                        <div className="text-sm text-gray-700 mb-2">
                          {record.description}
                        </div>
                        
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2 text-sm text-gray-600">
                          <div><span className="font-medium text-gray-700">KM:</span> {record.odometer}</div>
                          <div><span className="font-medium text-gray-700">Custo:</span> R$ {record.cost.toFixed(2)}</div>
                          {(record.nextOdometer || record.nextDate) && (
                             <div className="col-span-2">
                               <span className="font-medium text-gray-700">Próxima:</span>{' '}
                               {record.nextDate && new Date(record.nextDate + 'T12:00:00').toLocaleDateString('pt-BR')} 
                               {record.nextDate && record.nextOdometer && ' ou '}
                               {record.nextOdometer && `KM ${record.nextOdometer}`}
                             </div>
                          )}
                          <div className="col-span-2 lg:col-span-4 text-xs text-gray-400">
                            Registrado por: {record.mechanicName}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex sm:flex-col items-center gap-2 justify-end sm:justify-start pt-2 sm:pt-0 border-t sm:border-0 border-gray-100">
                        <button
                          onClick={() => handleEdit(record)}
                          className="p-2 text-gray-500 hover:text-indigo-600 bg-gray-50 hover:bg-indigo-50 rounded-lg transition-colors flex-1 sm:flex-none flex justify-center"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(record.id)}
                          className="p-2 text-gray-500 hover:text-red-600 bg-gray-50 hover:bg-red-50 rounded-lg transition-colors flex-1 sm:flex-none flex justify-center"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MechanicPanel;
