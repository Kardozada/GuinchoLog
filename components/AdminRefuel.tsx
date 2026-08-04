import React, { useState, useEffect } from 'react';
import { FuelRecord } from '../types';
import { VEHICLES, POSTOS, TIPOS_COMBUSTIVEL } from '../constants';
import { fetchFuelRecords, deleteFuelRecord, saveFuelRecord } from '../services/storage';
import { Droplet, Calendar, Loader2, Edit2, Trash2, User as UserIcon, X, Search, BarChart3, Save, Image as ImageIcon, ChevronUp, ChevronDown } from 'lucide-react';

const AdminRefuel: React.FC = () => {
  const [records, setRecords] = useState<FuelRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [filterVehicle, setFilterVehicle] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Editing state
  const [editingRecord, setEditingRecord] = useState<FuelRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showConsumption, setShowConsumption] = useState(true);

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    setIsLoading(true);
    const data = await fetchFuelRecords();
    setRecords(data);
    setIsLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este abastecimento?')) return;
    try {
      await deleteFuelRecord(id);
      await loadRecords();
    } catch (error) {
      console.error('Erro ao deletar:', error);
      alert('Erro ao excluir abastecimento.');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    
    setIsSubmitting(true);
    try {
      const updatedRecord = {
        ...editingRecord,
        total: editingRecord.liters * editingRecord.pricePerLiter
      };
      await saveFuelRecord(updatedRecord);
      await loadRecords();
      setEditingRecord(null);
    } catch (error) {
      console.error('Erro ao atualizar:', error);
      alert('Erro ao atualizar abastecimento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Apply filters
  const filteredRecords = records.filter(record => {
    if (filterVehicle && record.vehicleId !== filterVehicle) return false;
    if (filterStartDate && record.date < filterStartDate) return false;
    if (filterEndDate && record.date > filterEndDate) return false;
    return true;
  });

  // KPI Calculation
  const getVehicleStats = () => {
    const stats: Record<string, { totalLiters: number, totalSpent: number, recordsWithOdo: {odo: number, liters: number}[] }> = {};
    
    // Initialize for all vehicles that have records in the filtered list
    filteredRecords.forEach(r => {
      if (!stats[r.vehicleId]) {
        stats[r.vehicleId] = { totalLiters: 0, totalSpent: 0, recordsWithOdo: [] };
      }
      stats[r.vehicleId].totalLiters += r.liters;
      stats[r.vehicleId].totalSpent += r.total;
      
      if (typeof r.odometer === 'number' && r.odometer > 0) {
        stats[r.vehicleId].recordsWithOdo.push({ odo: r.odometer, liters: r.liters });
      }
    });

    const result = Object.entries(stats).map(([vehicleId, data]) => {
      const vehicle = VEHICLES.find(v => v.id === vehicleId);
      
      // Calculate average consumption
      let avgConsumption: string | number = "Dados insuficientes";
      if (data.recordsWithOdo.length >= 2) {
        // Sort by odometer
        const sorted = data.recordsWithOdo.sort((a, b) => a.odo - b.odo);
        const minOdo = sorted[0].odo;
        const maxOdo = sorted[sorted.length - 1].odo;
        
        let litersConsumed = 0;
        for (let i = 0; i < sorted.length; i++) {
          litersConsumed += sorted[i].liters;
        }
        
        if (litersConsumed > 0) {
          avgConsumption = ((maxOdo - minOdo) / litersConsumed).toFixed(2);
        }
      }

      return {
        vehicleId,
        vehicleName: vehicle?.name || vehicleId,
        totalLiters: data.totalLiters,
        totalSpent: data.totalSpent,
        avgConsumption
      };
    });

    return result.sort((a, b) => {
      const indexA = VEHICLES.findIndex(v => v.id === a.vehicleId);
      const indexB = VEHICLES.findIndex(v => v.id === b.vehicleId);
      
      if (indexA === -1 && indexB === -1) return a.vehicleName.localeCompare(b.vehicleName);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  };

  const stats = getVehicleStats();

  return (
    <div className="space-y-6">
      {/* Resumo / Relatório */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 sm:p-6 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
            <h2 className="text-lg font-bold text-gray-900">Média de Consumo por Caminhão</h2>
          </div>
          <button 
            onClick={() => setShowConsumption(!showConsumption)}
            className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
            title={showConsumption ? "Ocultar" : "Mostrar"}
          >
            {showConsumption ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
        
        {showConsumption && (
          <div className="p-4 sm:p-6">
            {stats.length === 0 ? (
              <p className="text-gray-500 text-sm">Nenhum dado para exibir com os filtros atuais.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.map(stat => (
                  <div key={stat.vehicleId} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="font-bold text-gray-900 mb-2 border-b border-gray-200 pb-2">{stat.vehicleName}</div>
                    <div className="space-y-1 text-sm text-gray-700">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Média:</span>
                        <span className="font-semibold">{stat.avgConsumption} {stat.avgConsumption !== 'Dados insuficientes' && 'km/l'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Total Litros:</span>
                        <span className="font-semibold">{stat.totalLiters.toFixed(2)} L</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Gasto Total:</span>
                        <span className="font-semibold text-red-600">
                          {stat.totalSpent.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2 text-gray-700 font-medium bg-gray-50">
          <Search className="w-5 h-5 text-gray-500" /> Filtros
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Veículo</label>
            <select
              value={filterVehicle}
              onChange={e => setFilterVehicle(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Todos</option>
              {VEHICLES.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Data Inicial</label>
            <input
              type="date"
              value={filterStartDate}
              onChange={e => setFilterStartDate(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Data Final</label>
            <input
              type="date"
              value={filterEndDate}
              onChange={e => setFilterEndDate(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>
      </div>

      {/* Histórico */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 sm:p-6 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-gray-600" />
            <h2 className="text-lg font-bold text-gray-900">Histórico de Abastecimentos</h2>
          </div>
          <span className="bg-gray-200 text-gray-700 text-xs font-bold px-2 py-1 rounded-full">
            {filteredRecords.length}
          </span>
        </div>
        
        <div className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-8 text-center text-gray-500 flex flex-col items-center">
              <Droplet className="w-12 h-12 mb-3 text-gray-300" />
              <p>Nenhum abastecimento encontrado.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredRecords.map(record => {
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
                        </div>
                        <div className="flex items-center gap-1 text-sm text-gray-500 mb-1">
                          <UserIcon className="w-4 h-4" />
                          {record.driverName}
                        </div>
                        
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2 text-sm text-gray-600">
                          <div><span className="font-medium text-gray-700">Posto:</span> {record.station}</div>
                          <div><span className="font-medium text-gray-700">Combustível:</span> {record.fuelType}</div>
                          <div><span className="font-medium text-gray-700">Litros:</span> {record.liters} L</div>
                          <div><span className="font-medium text-gray-700">Preço:</span> R$ {record.pricePerLiter.toFixed(2)}</div>
                          <div><span className="font-medium text-gray-700">Odômetro:</span> {record.odometer || '-'}</div>
                          <div className="lg:col-span-2">
                            <span className="font-medium text-gray-700">Total:</span>{' '}
                            <span className="font-bold text-green-700">
                              {record.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>
                          {(record.observations || record.proofImage) && (
                            <div className="col-span-2 lg:col-span-4 flex items-center justify-between mt-1 pt-1 border-t border-gray-100">
                              <span className="text-xs italic text-gray-500">
                                {record.observations ? `Obs: ${record.observations}` : ''}
                              </span>
                              {record.proofImage && (
                                <button
                                  onClick={() => setPreviewImage(record.proofImage!)}
                                  className="flex items-center gap-1 text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded transition-colors"
                                >
                                  <ImageIcon className="w-3 h-3" />
                                  <span>Ver Comprovante</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex sm:flex-col items-center gap-2 justify-end sm:justify-start pt-2 sm:pt-0 border-t sm:border-0 border-gray-100">
                        <button
                          onClick={() => setEditingRecord(record)}
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

      {/* Modal de Edição */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-start pt-10 px-4 overflow-y-auto pb-10">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-bold text-lg text-gray-900">Editar Abastecimento</h3>
              <button onClick={() => setEditingRecord(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
                  <input
                    type="date"
                    required
                    value={editingRecord.date}
                    onChange={(e) => setEditingRecord({...editingRecord, date: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Veículo *</label>
                  <select
                    required
                    value={editingRecord.vehicleId}
                    onChange={(e) => setEditingRecord({...editingRecord, vehicleId: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    {VEHICLES.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Posto *</label>
                  <select
                    required
                    value={editingRecord.station}
                    onChange={(e) => setEditingRecord({...editingRecord, station: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    {POSTOS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Combustível *</label>
                  <select
                    required
                    value={editingRecord.fuelType}
                    onChange={(e) => setEditingRecord({...editingRecord, fuelType: e.target.value})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    {TIPOS_COMBUSTIVEL.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Litros *</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.1"
                    required
                    value={editingRecord.liters}
                    onChange={(e) => setEditingRecord({...editingRecord, liters: Number(e.target.value)})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preço/Litro (R$) *</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.1"
                    required
                    value={editingRecord.pricePerLiter}
                    onChange={(e) => setEditingRecord({...editingRecord, pricePerLiter: Number(e.target.value)})}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Odômetro</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={editingRecord.odometer || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setEditingRecord({...editingRecord, odometer: val ? Number(val) : undefined})
                    }}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total (R$)</label>
                  <div className="w-full p-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-800 font-bold">
                    {((editingRecord.liters || 0) * (editingRecord.pricePerLiter || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                  <textarea
                    value={editingRecord.observations || ''}
                    onChange={(e) => setEditingRecord({...editingRecord, observations: e.target.value})}
                    rows={2}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full flex flex-col items-center">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-12 right-0 p-2 text-white/80 hover:text-white transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
            <img 
              src={previewImage} 
              alt="Comprovante de Abastecimento" 
              className="max-h-[85vh] object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRefuel;
