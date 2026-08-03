import React, { useState, useEffect } from 'react';
import { MaintenanceRecord } from '../types';
import { VEHICLES } from '../constants';
import { fetchMaintenanceRecords } from '../services/storage';
import { Wrench, Calendar, Loader2, Search, Filter, AlertTriangle, FileSpreadsheet, Download } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import * as XLSX from 'xlsx';

const AdminMaintenance: React.FC = () => {
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filtros
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    setIsLoading(true);
    const data = await fetchMaintenanceRecords();
    setRecords(data);
    setIsLoading(false);
  };

  // Aplicação de filtros
  const filteredRecords = records.filter(r => {
    let pass = true;
    if (vehicleFilter && r.vehicleId !== vehicleFilter) pass = false;
    if (startDate && r.date < startDate) pass = false;
    if (endDate && r.date > endDate) pass = false;
    return pass;
  });

  // KPI Calculations
  const totalCost = filteredRecords.reduce((acc, curr) => acc + curr.cost, 0);

  const costByVehicle = VEHICLES.map(v => {
    const total = filteredRecords
      .filter(r => r.vehicleId === v.id)
      .reduce((sum, r) => sum + r.cost, 0);
    return { name: v.name, value: total };
  }).filter(item => item.value > 0);

  const costByType = filteredRecords.reduce((acc, curr) => {
    acc[curr.type] = (acc[curr.type] || 0) + curr.cost;
    return acc;
  }, {} as Record<string, number>);

  const pieDataType = Object.keys(costByType).map(key => ({
    name: key,
    value: costByType[key]
  }));

  const COLORS = ['#4f46e5', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef'];

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

  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      filteredRecords.map(r => ({
        Data: r.date,
        Veículo: VEHICLES.find(v => v.id === r.vehicleId)?.name || r.vehicleId,
        Tipo: r.type,
        Descrição: r.description,
        'Custo (R$)': r.cost,
        Odômetro: r.odometer,
        'Próxima (KM)': r.nextOdometer || '-',
        'Próxima (Data)': r.nextDate || '-',
        Mecânico: r.mechanicName
      }))
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Manutencao');
    XLSX.writeFile(workbook, 'Relatorio_Manutencao.xlsx');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Lembretes */}
      {reminders.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
          <div className="p-4 bg-red-50 border-b border-red-100 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h2 className="text-md font-bold text-red-900">Avisos de Manutenção (Todas as VTRs)</h2>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-center items-center">
          <div className="text-gray-500 text-sm font-medium mb-1">Custo Total em Manutenção</div>
          <div className="text-3xl font-bold text-indigo-600">R$ {totalCost.toFixed(2)}</div>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-center items-center">
          <div className="text-gray-500 text-sm font-medium mb-1">Registros Filtrados</div>
          <div className="text-3xl font-bold text-gray-900">{filteredRecords.length}</div>
        </div>
      </div>

      {/* Charts */}
      {filteredRecords.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-sm font-bold text-gray-700 mb-4 text-center">Custo por Veículo (R$)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={costByVehicle}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {costByVehicle.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-sm font-bold text-gray-700 mb-4 text-center">Custo por Tipo de Serviço (R$)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieDataType}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieDataType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Tabela / Lista de Registros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 sm:p-6 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Wrench className="w-6 h-6 text-gray-600" />
            <h2 className="text-lg font-bold text-gray-900">Relatório de Manutenções</h2>
          </div>
          <button
            onClick={exportToExcel}
            disabled={filteredRecords.length === 0}
            className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-medium transition-colors text-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Exportar XLS
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 bg-white border-b border-gray-100 flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Veículo</label>
            <select
              value={vehicleFilter}
              onChange={(e) => setVehicleFilter(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            >
              <option value="">Todas as VTRs</option>
              {VEHICLES.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Data Inicial</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Data Final</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
          </div>
        </div>

        {/* Data List */}
        <div className="divide-y divide-gray-100">
          {filteredRecords.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Nenhum registro encontrado para os filtros atuais.
            </div>
          ) : (
            filteredRecords.map(record => {
              const vehicle = VEHICLES.find(v => v.id === record.vehicleId);
              return (
                <div key={record.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">
                          {new Date(record.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </span>
                        <span className="text-gray-300">•</span>
                        <span className="text-indigo-600 font-semibold">{vehicle?.name || record.vehicleId}</span>
                        <span className="text-gray-300">•</span>
                        <span className="text-gray-700 font-medium">{record.type}</span>
                      </div>
                      
                      <div className="text-sm text-gray-700">
                        {record.description}
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-2 text-sm text-gray-600">
                        <div><span className="font-medium">KM:</span> {record.odometer}</div>
                        <div><span className="font-medium">Custo:</span> R$ {record.cost.toFixed(2)}</div>
                        <div className="col-span-2">
                          <span className="font-medium">Mecânico:</span> {record.mechanicName}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminMaintenance;
