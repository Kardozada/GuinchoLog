import React, { useEffect, useState } from 'react';
import { getAllLogs, updateLog, getCurrentUser, deleteLog } from '../services/storage';
import { analyzeDailyLogs } from '../services/geminiService';
import { DailyLog, ServiceItem, ExpenseItem, PaymentMethod, EditHistoryEntry } from '../types';
import { MOCK_DRIVERS, VEHICLES, getLocalDate, getLocalDateFromDate } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Bot, FileText, Search, TrendingUp, RefreshCw, AlertTriangle, X, Copy, Check, Settings, Calendar, Users, ChevronDown, ChevronRight, MapPin, Clock, Truck, DollarSign, Image as ImageIcon, LayoutDashboard, Pencil, History, Save, Trash2, Plus, Square, CheckSquare, Stamp, Droplet, Wrench, User as UserIcon, Minus } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import AdminRefuel from './AdminRefuel';
import AdminMaintenance from './AdminMaintenance';

// --- GAS SCRIPT ATUALIZADO (Suporte a Update/Upsert) ---
const GAS_SCRIPT_CODE = `// =======================================================
// COLE ESTE CÓDIGO NO GOOGLE APPS SCRIPT
// =======================================================

function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const doc = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = doc.getSheetByName('Logs');
    if (!sheet) { setup(); sheet = doc.getSheetByName('Logs'); }

    // --- GET: Retornar todos os dados ---
    if (!e.postData) {
      const data = sheet.getDataRange().getValues();
      if (data.length < 2) return outputJSON([]); 
      const headers = data[0];
      const rows = data.slice(1);
      const logs = rows.map(row => {
        const obj = {};
        headers.forEach((header, index) => {
          let value = row[index];
          // Parse JSON strings back to objects
          if ((header === 'services' || header === 'expenses' || header === 'editHistory') && typeof value === 'string' && value.startsWith('[')) {
            try { value = JSON.parse(value); } catch(err) {}
          }
          if (value instanceof Date) value = value.toISOString();
          obj[header] = value;
        });
        return obj;
      });
      return outputJSON(logs);
    }

    // --- POST: Inserir ou Atualizar (Upsert) ou Deletar ---
    const payload = JSON.parse(e.postData.contents);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const idColumnIndex = headers.indexOf('id');

    if (idColumnIndex === -1) return outputJSON({ status: 'error', message: 'Coluna ID não encontrada' });

    let rowToUpdate = -1;
    if (payload.id) {
       const allIds = sheet.getRange(2, idColumnIndex + 1, sheet.getLastRow() - 1, 1).getValues().flat();
       const foundIndex = allIds.indexOf(payload.id);
       if (foundIndex !== -1) {
         rowToUpdate = foundIndex + 2;
       }
    }

    if (payload._action === 'delete') {
      if (rowToUpdate !== -1) {
        sheet.deleteRow(rowToUpdate);
        return outputJSON({ status: 'deleted', id: payload.id });
      }
      return outputJSON({ status: 'not_found', id: payload.id });
    }

    // Preparar a linha de dados
    const rowData = headers.map(header => {
      if (header.startsWith('_')) return ''; 
      let value = payload[header];
      if (typeof value === 'object' && value !== null) value = JSON.stringify(value);
      return value === undefined ? '' : value;
    });

    if (rowToUpdate !== -1) {
      sheet.getRange(rowToUpdate, 1, 1, rowData.length).setValues([rowData]);
      return outputJSON({ status: 'updated', id: payload.id });
    } else {
      sheet.appendRow(rowData);
      return outputJSON({ status: 'created', id: payload.id });
    }

  } catch (err) { return outputJSON({ status: 'error', message: err.toString() }); } 
  finally { lock.releaseLock(); }
}

function outputJSON(data) { return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Logs');
  if (!sheet) {
    sheet = ss.insertSheet('Logs');
    sheet.appendRow(['id', 'userId', 'driverName', 'date', 'vehicleId', 'kmStart', 'kmEnd', 'services', 'expenses', 'observations', 'totalInvoiced', 'totalLiquidCash', 'totalLiquidTerm', 'totalExpenses', 'submittedAt', 'checkedHudson', 'checkedAndre', 'checked', 'editHistory']);
  }
}`;

type TabView = 'overview' | 'dates' | 'drivers' | 'cash' | 'refuel' | 'maintenance';

const AdminDashboard: React.FC = () => {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const currentUser = getCurrentUser();
  
  // Navigation State
  const [activeTab, setActiveTab] = useState<TabView>('overview');
  const [cashTabDate, setCashTabDate] = useState(getLocalDate());
  
  // Date Navigation State
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [expandedDateDrivers, setExpandedDateDrivers] = useState<Set<string>>(new Set());

  // Driver Navigation State
  const [driverSearch, setDriverSearch] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [expandedDriverDates, setExpandedDriverDates] = useState<Set<string>>(new Set()); 
  const [showOnlyPending, setShowOnlyPending] = useState(true); 

  // Modal State
  const [showSetup, setShowSetup] = useState(false);
  const [copied, setCopied] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  // Edit State
  const [editingLog, setEditingLog] = useState<DailyLog | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // --- Data Loading ---
  const loadData = async () => {
    setLoadingData(true);
    let rawLogs: DailyLog[] = await getAllLogs();

    // Deduplicar por ID para evitar erros de chave no React e duplicidade visual
    const uniqueLogsMap = new Map<string, DailyLog>();
    rawLogs.forEach(log => {
      // Ensure boolean values for checked fields, handling strings from Google Sheets
      const rawAndre: any = log.checkedAndre;
      const rawHudson: any = log.checkedHudson;
      const rawChecked: any = log.checked;
      
      const isCheckedAndre = rawAndre === true || rawAndre === 'true' || rawAndre === 'TRUE' || rawChecked === true || rawChecked === 'true' || rawChecked === 'TRUE';
      const isCheckedHudson = rawHudson === true || rawHudson === 'true' || rawHudson === 'TRUE';
      
      // Ensure date is YYYY-MM-DD
      let formattedDate = log.date ? String(log.date) : '';
      if (formattedDate.includes('/')) {
        const parts = formattedDate.split('/');
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            // YYYY/MM/DD
            formattedDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
          } else {
            // Check if MM/DD/YYYY or DD/MM/YYYY
            const p0 = parseInt(parts[0], 10);
            const p1 = parseInt(parts[1], 10);
            if (p0 > 12) {
              // DD/MM/YYYY
              formattedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            } else if (p1 > 12) {
              // MM/DD/YYYY
              formattedDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
            } else {
              // Ambiguous, default to DD/MM/YYYY as it's Brazil
              formattedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
          }
        }
      } else {
        const baseDate = formattedDate.split('T')[0];
        if (baseDate.includes('-')) {
          const parts = baseDate.split('-');
          if (parts.length === 3) {
            formattedDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
          } else {
            formattedDate = baseDate;
          }
        } else {
          formattedDate = baseDate;
        }
      }
      
      // Validate the constructed formattedDate
      if (!formattedDate || isNaN(new Date(formattedDate).getTime())) {
        if (log.submittedAt) {
          const submittedParsed = new Date(log.submittedAt);
          if (!isNaN(submittedParsed.getTime())) {
             formattedDate = getLocalDateFromDate(submittedParsed);
          } else {
             formattedDate = getLocalDate();
          }
        } else {
          formattedDate = getLocalDate();
        }
      }

      const servicesArray = Array.isArray(log.services) ? log.services : [];
      const expensesArray = Array.isArray(log.expenses) ? log.expenses : [];
      
      const calculatedTotalInvoiced = servicesArray.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
      const calculatedTotalExpenses = expensesArray.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
      const calculatedTotalLiquidTerm = servicesArray
        .filter(s => s.paymentMethod === 'A PRAZO')
        .reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
      const calculatedTotalLiquidCash = servicesArray
        .filter(s => s.paymentMethod === 'DINHEIRO')
        .reduce((acc, curr) => acc + (Number(curr.value) || 0), 0) - calculatedTotalExpenses;

      // Normalize driverName to match MOCK_DRIVERS if possible
      const matchedDriver = MOCK_DRIVERS.find(d => 
        (log.userId && d.id === log.userId) || 
        (log.driverName && d.name.toLowerCase().trim() === log.driverName.toLowerCase().trim())
      );
      const officialName = matchedDriver ? matchedDriver.name : (log.driverName || 'Motorista Desconhecido');

      uniqueLogsMap.set(log.id, {
        ...log,
        driverName: officialName,
        date: formattedDate,
        totalInvoiced: calculatedTotalInvoiced,
        totalExpenses: calculatedTotalExpenses,
        totalLiquidCash: calculatedTotalLiquidCash,
        totalLiquidTerm: calculatedTotalLiquidTerm,
        checkedAndre: isCheckedAndre,
        checkedHudson: isCheckedHudson,
        checked: isCheckedAndre // keep legacy field in sync
      });
    });
    
    // Sort before setting
    const finalLogs = Array.from(uniqueLogsMap.values()).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setLogs(finalLogs);
    setLoadingData(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAiAnalysis = async () => {
    if (logs.length === 0) return;
    setLoadingAi(true);
    const result = await analyzeDailyLogs(logs);
    setAiAnalysis(result);
    setLoadingAi(false);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(GAS_SCRIPT_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- Helpers for Grouping ---
  const getLogsByMonth = () => {
    const grouped: Record<string, Record<string, DailyLog[]>> = {};

    logs.forEach(log => {
      let dateObj = new Date(log.date);
      let monthKey = "Inválido";
      let dayKey = "Data Não Informada";
      
      if (!isNaN(dateObj.getTime())) {
          monthKey = `${dateObj.getUTCFullYear()}-${String(dateObj.getUTCMonth() + 1).padStart(2, '0')}`;
          dayKey = log.date; 
      }

      if (!grouped[monthKey]) grouped[monthKey] = {};
      if (!grouped[monthKey][dayKey]) grouped[monthKey][dayKey] = [];
      grouped[monthKey][dayKey].push(log);
    });
    return grouped;
  };

  const formatMonth = (monthKey: string) => {
    if (!monthKey || monthKey.includes('NaN')) return 'MÊS DESCONHECIDO';
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
  };

  const formatDateHeader = (dateStr: string) => {
    const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T12:00:00');
    if (isNaN(d.getTime())) return { short: dateStr || 'Data Desconhecida', full: '' };
    return {
      short: d.toLocaleDateString('pt-BR'),
      full: `- ${d.toLocaleDateString('pt-BR', { weekday: 'long' })}`
    };
  };

  const toggleSet = (set: Set<string>, val: string, update: (s: Set<string>) => void) => {
    const newSet = new Set(set);
    if (newSet.has(val)) newSet.delete(val);
    else newSet.add(val);
    update(newSet);
  };

  // --- Editing Logic ---
  const handleEditClick = (log: DailyLog) => {
    setEditingLog(JSON.parse(JSON.stringify(log))); // Deep copy
  };

  const handleCloseEdit = () => {
    setEditingLog(null);
  };

  const handleSaveEdit = async () => {
    if (!editingLog || !currentUser) return;
    setIsSavingEdit(true);

    // 1. Recalculate Totals
    const totalInvoiced = editingLog.services.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
    const totalExpenses = editingLog.expenses.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
    const totalLiquidTerm = editingLog.services
      .filter(s => s.paymentMethod === PaymentMethod.ON_TERM)
      .reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
    const totalLiquidCash = editingLog.services
      .filter(s => s.paymentMethod === PaymentMethod.CASH || (s.paymentMethod as any) === 'DINHEIRO')
      .reduce((acc, curr) => acc + (Number(curr.value) || 0), 0) - totalExpenses;

    // 2. Prepare Log with new totals
    const updatedLog: DailyLog = {
      ...editingLog,
      totalInvoiced,
      totalExpenses,
      totalLiquidTerm,
      totalLiquidCash
    };

    // 3. Create Audit Entry
    const historyEntry: EditHistoryEntry = {
      editedBy: currentUser.name,
      editedAt: new Date().toISOString(),
      changes: "Edição Administrativa completa do registro." // Simplificado para este exemplo
    };

    updatedLog.editHistory = [...(updatedLog.editHistory || []), historyEntry];

    try {
      // 4. Save
      await updateLog(updatedLog);
      
      // 5. Update Local State
      setLogs(logs.map(l => l.id === updatedLog.id ? updatedLog : l));
      
      setIsSavingEdit(false);
      setEditingLog(null);
    } catch (error) {
      console.error("Erro ao atualizar o log:", error);
      alert("Falha ao salvar as edições. Verifique sua conexão e permissões.");
      setIsSavingEdit(false);
    }
  };

  const updateEditField = (field: keyof DailyLog, value: any) => {
    if (!editingLog) return;
    setEditingLog({ ...editingLog, [field]: value });
  };

  const toggleLogChecked = (logIds: string[], field: 'checkedHudson' | 'checkedAndre') => {
    // Determinar o estado alvo baseado no primeiro log da lista que coincida com os IDs
    const firstMatch = logs.find(l => logIds.includes(l.id));
    if (!firstMatch) return;
    
    // Se o primeiro está desmarcado, vamos marcar todos. Se está marcado, vamos desmarcar todos.
    const targetValue = !firstMatch[field];

    // 1. Atualização Otimista
    const updatedLogs = logs.map(log => {
      if (logIds.includes(log.id)) {
        const updatedLog = { ...log, [field]: targetValue };
        if (field === 'checkedAndre') {
          updatedLog.checked = targetValue;
        }
        return updatedLog;
      }
      return log;
    });
    setLogs(updatedLogs);

    // 2. Persistência em segundo plano
    const logsToUpdate = updatedLogs.filter(l => logIds.includes(l.id));
    
    Promise.all(logsToUpdate.map(log => updateLog(log)))
      .catch(err => {
        console.error(`Erro ao sincronizar estado de check (${field}):`, err);
      });
  };

  const handleDeleteLog = async (id: string) => {
    if (!confirm(`Tem certeza que deseja excluir este relatório? Esta ação não pode ser desfeita.`)) return;

    // 1. Atualização Otimista
    setLogs(prev => prev.filter(l => l.id !== id));

    // 2. Exclusão no background
    setLoadingData(true);
    try {
      await deleteLog(id);
    } catch (err) {
      console.error("Erro ao excluir log:", err);
    } finally {
      setLoadingData(false);
    }
  };

  const updateServiceInEdit = (index: number, field: keyof ServiceItem, value: any) => {
    if (!editingLog) return;
    const newServices = [...editingLog.services];
    newServices[index] = { ...newServices[index], [field]: value };
    setEditingLog({ ...editingLog, services: newServices });
  };

  const removeServiceInEdit = (index: number) => {
    if (!editingLog) return;
    const newServices = editingLog.services.filter((_, i) => i !== index);
    setEditingLog({ ...editingLog, services: newServices });
  };

  const addServiceInEdit = () => {
    if (!editingLog) return;
    const newService: ServiceItem = {
      id: Math.random().toString(36).substr(2, 9),
      startTime: '', endTime: '', departure: '', destination: '',
      towedVehicle: '', towedPlate: '', clientName: '', clientPhone: '',
      paymentMethod: PaymentMethod.CASH, value: 0
    };
    setEditingLog({ ...editingLog, services: [...editingLog.services, newService] });
  };

  const updateExpenseInEdit = (index: number, field: keyof ExpenseItem, value: any) => {
    if (!editingLog) return;
    const newExpenses = [...editingLog.expenses];
    newExpenses[index] = { ...newExpenses[index], [field]: value };
    setEditingLog({ ...editingLog, expenses: newExpenses });
  };

  const removeExpenseInEdit = (index: number) => {
    if (!editingLog) return;
    const newExpenses = editingLog.expenses.filter((_, i) => i !== index);
    setEditingLog({ ...editingLog, expenses: newExpenses });
  };

  const addExpenseInEdit = () => {
    if (!editingLog) return;
    setEditingLog({ ...editingLog, expenses: [...editingLog.expenses, { id: Math.random().toString(36).substr(2, 9), description: '', value: 0 }] });
  };

  // --- Components ---

  const ServiceDetailTable = ({ services }: { services: ServiceItem[] }) => (
    <div className="overflow-x-auto mt-4 border rounded-lg border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-xs md:text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-500">Horários</th>
            <th className="px-3 py-2 text-left font-medium text-gray-500">Trajeto</th>
            <th className="px-3 py-2 text-left font-medium text-gray-500">Veículo / Placa</th>
            <th className="px-3 py-2 text-left font-medium text-gray-500">Cliente</th>
            <th className="px-3 py-2 text-left font-medium text-gray-500">Pagamento</th>
            <th className="px-3 py-2 text-right font-medium text-gray-500">Valor</th>
            <th className="px-3 py-2 text-center font-medium text-gray-500">Comp.</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {(services || []).map((s, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                <div className="flex flex-col">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> {s.startTime} - {s.endTime}</span>
                </div>
              </td>
              <td className="px-3 py-2 text-gray-600">
                <div className="flex flex-col max-w-[150px]">
                  <span className="truncate" title={s.departure}>De: {s.departure}</span>
                  <span className="truncate" title={s.destination}>Para: {s.destination}</span>
                </div>
              </td>
              <td className="px-3 py-2 text-gray-600">
                <div className="font-medium">{s.towedVehicle}</div>
                <div className="text-xs bg-gray-100 inline-block px-1 rounded">{s.towedPlate}</div>
              </td>
              <td className="px-3 py-2 text-gray-600">{s.clientName}</td>
              <td className="px-3 py-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium 
                  ${s.paymentMethod === 'DINHEIRO' || s.paymentMethod === 'PIX' ? 'bg-green-100 text-green-800' : 
                    s.paymentMethod.includes('PRAZO') ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                  {s.paymentMethod}
                </span>
              </td>
              <td className="px-3 py-2 text-right font-medium text-gray-900">
                R$ {s.value?.toFixed(2) || '0.00'}
              </td>
              <td className="px-3 py-2 text-center">
                {s.proofImage ? (
                  <button onClick={() => setPreviewImage(s.proofImage!)} className="text-indigo-600 hover:text-indigo-800 p-1">
                    {s.proofImage.startsWith('data:application/pdf') ? <FileText className="w-4 h-4 text-red-500" /> : <ImageIcon className="w-4 h-4"/>}
                  </button>
                ) : (
                  <span className="text-gray-300">-</span>
                )}
              </td>
            </tr>
          ))}
          {(!services || services.length === 0) && (
            <tr><td colSpan={7} className="text-center py-4 text-gray-400">Nenhum serviço neste relatório.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  // Component to render details of a specific Log (used inside both Date and Driver tabs)
  const LogDetailsContent = ({ log }: { log: DailyLog }) => (
    <div className="border-t border-gray-100 p-4 bg-gray-50/50">
      <div className="flex justify-between items-center mb-2">
         <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-mono">ID: {log.id.substring(0, 8)}</span>
         </div>
         <div className="flex gap-2">
            <button 
              onClick={() => handleEditClick(log)}
              className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded transition-colors"
            >
              <Pencil className="w-3 h-3" /> Editar
            </button>
            <button 
              onClick={() => handleDeleteLog(log.id)}
              className="flex items-center gap-1 text-xs font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Excluir
            </button>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-sm">
          <div className="bg-white p-3 rounded border border-gray-100">
            <span className="text-gray-500 block text-xs uppercase font-bold">Resumo da Frota</span>
            <div className="mt-2 text-gray-700 space-y-1">
               <div className="flex items-center gap-2"><Truck className="w-4 h-4 text-indigo-500"/> {log.vehicleId.toUpperCase().replace('VTR-', 'VTR ')}</div>
            </div>
          </div>
          <div className="bg-white p-3 rounded border border-gray-100">
            <span className="text-gray-500 block text-xs uppercase font-bold">Despesas</span>
            <p className="text-red-600 font-medium mt-1">Total: R$ {log.totalExpenses.toFixed(2)}</p>
            <ul className="text-xs text-gray-400 mt-1">
              {(log.expenses || []).map((e, i) => <li key={i}>• {e.description}: R$ {e.value}</li>)}
            </ul>
          </div>
          <div className="bg-white p-3 rounded border border-gray-100">
            <span className="text-gray-500 block text-xs uppercase font-bold">Observações</span>
            <p className="text-gray-800 mt-1 italic">"{log.observations || 'Sem observações.'}"</p>
          </div>
      </div>
      
      {log.editHistory && log.editHistory.length > 0 && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 p-3 rounded text-xs text-yellow-800">
           <strong className="flex items-center gap-1 mb-1"><History className="w-3 h-3"/> Histórico de Edição:</strong>
           <ul className="list-disc pl-4 space-y-1">
             {log.editHistory.map((h, i) => (
               <li key={i}>
                 Editado por <strong>{h.editedBy}</strong> em {new Date(h.editedAt).toLocaleString('pt-BR')}
               </li>
             ))}
           </ul>
        </div>
      )}

      <h5 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-2">
        <FileText className="w-4 h-4"/> Detalhes dos Serviços
      </h5>
      <ServiceDetailTable services={log.services} />
    </div>
  );

  const renderOverview = () => {
    // KPI Data Calculation
    const totalRevenue = logs.reduce((acc, l) => acc + l.totalInvoiced, 0);
    const totalServices = logs.reduce((acc, l) => acc + (Array.isArray(l.services) ? l.services.length : 0), 0);
    const activeDrivers = new Set(logs.map(l => l.userId)).size;
    
    // Chart Data
    const revenueByDriver = logs.reduce((acc, log) => {
      const existing = acc.find(a => a.name === log.driverName);
      if (existing) existing.value += log.totalInvoiced;
      else acc.push({ name: log.driverName, value: log.totalInvoiced });
      return acc;
    }, [] as { name: string; value: number }[]).sort((a,b) => b.value - a.value).slice(0, 10); // Top 10

    const totalLiquidCompany = logs.reduce((acc, log) => acc + log.totalInvoiced - log.totalExpenses, 0);

    return (
      <div className="space-y-6 animate-fade-in">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm">Serviços Realizados</p>
            <h3 className="text-2xl font-bold text-indigo-600">{totalServices}</h3>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm">Motoristas Ativos</p>
            <h3 className="text-2xl font-bold text-gray-800">{activeDrivers}</h3>
          </div>
        </div>

        {/* Charts & AI */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-gray-500"/> Top 10 Faturamento
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByDriver}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{fontSize: 10}} interval={0} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#4f46e5" name="Faturamento (R$)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* AI Analysis Section */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-lg font-bold mb-2 flex items-center gap-2 text-indigo-700">
                <Bot className="w-6 h-6" /> Assistente Gemini IA
              </h3>
              <p className="text-gray-500 text-sm mb-4">
                Analise os logs para identificar padrões e anomalias.
              </p>
              {!aiAnalysis ? (
                <button onClick={handleAiAnalysis} disabled={loadingAi} className="w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-indigo-700 transition-colors disabled:opacity-70">
                  {loadingAi ? 'Analisando...' : 'Gerar Relatório'}
                </button>
              ) : (
                <div className="mt-4 bg-gray-50 p-4 rounded-lg text-sm max-h-80 overflow-y-auto border border-gray-200 text-gray-800 prose prose-sm max-w-none">
                  <ReactMarkdown>{aiAnalysis}</ReactMarkdown>
                  <button onClick={() => setAiAnalysis('')} className="mt-4 text-xs underline text-indigo-600">Limpar</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderByDate = () => {
    const isHudson = currentUser?.name?.toLowerCase().includes('hudson');
    const isAndre = currentUser?.name?.toLowerCase().includes('andre');
    const isMatheus = currentUser?.name?.toLowerCase().includes('matheus');
    const isSuperAdmin = isMatheus || (!isHudson && !isAndre && currentUser?.role === 'ADMIN');

    const groupedLogs = getLogsByMonth();
    const months = Object.keys(groupedLogs).sort((a, b) => b.localeCompare(a));

    if (months.length === 0) {
      return <div className="p-8 text-center text-gray-500">Nenhum registro encontrado.</div>;
    }

    return (
      <div className="space-y-4 animate-fade-in">
        {months.map(month => (
          <div key={month} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Month Header */}
            <div 
              className="bg-gray-50 px-6 py-4 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => toggleSet(expandedMonths, month, setExpandedMonths)}
            >
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600"/>
                {formatMonth(month)}
              </h3>
              {expandedMonths.has(month) ? <ChevronDown className="w-5 h-5 text-gray-400"/> : <ChevronRight className="w-5 h-5 text-gray-400"/>}
            </div>

            {/* Days List */}
            {expandedMonths.has(month) && (
              <div className="p-4 space-y-2 border-t border-gray-100 bg-gray-50">
                {Object.keys(groupedLogs[month]).sort((a,b) => b.localeCompare(a)).map(day => {
                  const dayTotalInvoiced = groupedLogs[month][day].reduce((acc, l) => acc + l.totalInvoiced, 0);
                  const dayUniqueDrivers = new Set(groupedLogs[month][day].map(l => l.driverName)).size;

                  return (
                    <div key={day} className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-2">
                      <div 
                        className="px-4 py-3 flex justify-between items-center cursor-pointer hover:bg-gray-50"
                        onClick={() => toggleSet(expandedDays, day, setExpandedDays)}
                      >
                        <div className="flex items-center gap-3">
                          {expandedDays.has(day) ? <ChevronDown className="w-4 h-4 text-gray-400"/> : <ChevronRight className="w-4 h-4 text-gray-400"/>}
                          <span className="font-semibold text-gray-800">
                             {formatDateHeader(day).short}
                          </span>
                          <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
                            {dayUniqueDrivers} Motoristas
                          </span>
                        </div>
                      </div>

                      {/* Drivers for the Day */}
                      {expandedDays.has(day) && (
                        <div className="border-t border-gray-100">
                          {(() => {
                            const logsByDriver: Record<string, DailyLog[]> = {};
                            groupedLogs[month][day].forEach(log => {
                              if (!logsByDriver[log.driverName]) logsByDriver[log.driverName] = [];
                              logsByDriver[log.driverName].push(log);
                            });

                            return Object.keys(logsByDriver).sort().map(driverName => {
                              const driverLogs = logsByDriver[driverName];
                              const driverDebt = driverLogs.reduce((acc, l) => acc + l.totalLiquidCash, 0);
                              const driverServicesCount = driverLogs.reduce((acc, l) => acc + (Array.isArray(l.services) ? l.services.length : 0), 0);
                              const isCheckedHudson = driverLogs.every(l => l.checkedHudson);
                              const isCheckedAndre = driverLogs.every(l => l.checkedAndre);
                              const expandKey = `${day}-${driverName}`;
                              const isExpanded = expandedDateDrivers.has(expandKey);

                              return (
                                <div key={expandKey} className="border-b border-gray-100 last:border-0">
                                  <div 
                                      className="px-4 py-3 pl-10 hover:bg-indigo-50 cursor-pointer flex justify-between items-center transition-colors"
                                      onClick={() => toggleSet(expandedDateDrivers, expandKey, setExpandedDateDrivers)}
                                  >
                                      <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1">
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (isHudson || isSuperAdmin) toggleLogChecked(driverLogs.map(l => l.id), 'checkedHudson');
                                            }}
                                            title="Conferência Hudson (Serviços)"
                                            className={`p-1 rounded transition-colors ${isCheckedHudson ? 'text-blue-600' : 'text-gray-300'} ${isHudson || isSuperAdmin ? 'hover:text-gray-400' : 'cursor-not-allowed opacity-50'}`}
                                            disabled={!isHudson && !isSuperAdmin}
                                          >
                                            <Stamp className="w-5 h-5" />
                                          </button>
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (isAndre || isSuperAdmin) toggleLogChecked(driverLogs.map(l => l.id), 'checkedAndre');
                                            }}
                                            title="Conferência André (Pagamento)"
                                            className={`p-1 rounded transition-colors ${isCheckedAndre ? 'text-green-600' : 'text-gray-300'} ${isAndre || isSuperAdmin ? 'hover:text-gray-400' : 'cursor-not-allowed opacity-50'}`}
                                            disabled={!isAndre && !isSuperAdmin}
                                          >
                                            {isCheckedAndre ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                          </button>
                                        </div>
                                        <span className="font-medium text-gray-700">
                                           {driverName}
                                           {driverLogs.length > 1 && (
                                              <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-200" title="Existem múltiplos relatórios para este dia">
                                                ({driverLogs.length} envios)
                                              </span>
                                           )}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-4 text-sm">
                                        <span className="text-gray-500 bg-white px-2 py-0.5 rounded border border-gray-200 shadow-sm text-xs mt-1">
                                            {driverServicesCount} Serviços
                                        </span>
                                        <div className="flex flex-col items-end w-32 border-l border-gray-200 pl-3">
                                          <span className="text-[10px] uppercase text-gray-400 font-bold leading-none mb-1">
                                              {driverDebt < 0 ? 'A Receber (Admin)' : 'Pagar ao Admin'}
                                          </span>
                                          <span className={`font-bold ${driverDebt < 0 ? 'text-amber-600' : isCheckedAndre ? 'text-green-600' : 'text-red-600'}`}>
                                              R$ {Math.abs(driverDebt).toFixed(2)}
                                          </span>
                                        </div>
                                        {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400"/> : <ChevronRight className="w-4 h-4 text-gray-400"/>}
                                      </div>
                                  </div>
                                  
                                  {isExpanded && (
                                    <div>
                                      {driverLogs.map(log => (
                                          <LogDetailsContent key={log.id} log={log} />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            });
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderDrivers = () => {
    const allDrivers = [...MOCK_DRIVERS];
    const isHudson = currentUser?.name?.toLowerCase().includes('hudson');
    const isAndre = currentUser?.name?.toLowerCase().includes('andre');
    const isMatheus = currentUser?.name?.toLowerCase().includes('matheus');
    const isSuperAdmin = isMatheus || (!isHudson && !isAndre && currentUser?.role === 'ADMIN');

    let processedDrivers = allDrivers;

    if (showOnlyPending && (isHudson || isAndre || isSuperAdmin)) {
      processedDrivers = processedDrivers.filter(d => {
        const pendingCountHudson = new Set(logs.filter(l => l.driverName === d.name && !l.checkedHudson).map(l => l.date)).size;
        const pendingCountAndre = new Set(logs.filter(l => l.driverName === d.name && !l.checkedAndre).map(l => l.date)).size;
        
        if (isHudson) return pendingCountHudson > 0;
        if (isAndre) return pendingCountAndre > 0;
        return pendingCountHudson > 0 || pendingCountAndre > 0; // For Matheus/SuperAdmin
      });
    }

    const filteredDrivers = processedDrivers.filter(d => 
      d.name.toLowerCase().includes(driverSearch.toLowerCase())
    ).sort((a, b) => a.name.localeCompare(b.name));

    const selectedDriverLogs = selectedDriverId 
      ? logs.filter(l => {
          const driver = allDrivers.find(d => d.id === selectedDriverId);
          return l.driverName === driver?.name || l.userId === selectedDriverId;
        }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      : [];

    const groupedByDate: Record<string, DailyLog[]> = {};
    if (selectedDriverId) {
       selectedDriverLogs.forEach(log => {
          if (!groupedByDate[log.date]) groupedByDate[log.date] = [];
          groupedByDate[log.date].push(log);
       });
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-fade-in h-[calc(100vh-200px)]">
        {/* Driver List Sidebar */}
        <div className="md:col-span-4 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
           <div className="p-4 border-b border-gray-100">
              <div className="relative mb-3">
                 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                 <input 
                   type="text" 
                   placeholder="Buscar motorista..." 
                   value={driverSearch}
                   onChange={(e) => setDriverSearch(e.target.value)}
                   className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                 />
              </div>
              {(isHudson || isAndre || isSuperAdmin) && (
                <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-200">
                   <input 
                      type="checkbox" 
                      checked={showOnlyPending}
                      onChange={(e) => setShowOnlyPending(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                   />
                   Só com pendências
                </label>
              )}
           </div>
           <div className="overflow-y-auto flex-1 p-2 space-y-1">
              {filteredDrivers.map(driver => {
                const isHudson = currentUser?.name?.toLowerCase().includes('hudson');
                const isAndre = currentUser?.name?.toLowerCase().includes('andre');
                
                const pendingCountHudson = new Set(logs.filter(l => l.driverName === driver.name && !l.checkedHudson).map(l => l.date)).size;
                const pendingCountAndre = new Set(logs.filter(l => l.driverName === driver.name && !l.checkedAndre).map(l => l.date)).size;

                const isMatheus = currentUser?.name?.toLowerCase().includes('matheus');
                const isSuperAdmin = isMatheus || (!isHudson && !isAndre && currentUser?.role === 'ADMIN');

                let count = 0;
                let labelText = '';

                if (isHudson) {
                  count = pendingCountHudson;
                  labelText = 'conferências pendentes';
                } else if (isAndre) {
                  count = pendingCountAndre;
                  labelText = 'relatórios pendentes';
                } else if (isSuperAdmin) {
                  count = pendingCountHudson + pendingCountAndre;
                  labelText = 'pendências (Total)';
                }
                
                let textColorClass = 'text-gray-400';
                if (count >= 1 && (isHudson || isAndre || isSuperAdmin)) {
                  textColorClass = 'text-red-500 font-medium';
                }

                return (
                <button
                  key={driver.id}
                  onClick={() => {
                     setSelectedDriverId(driver.id);
                     setExpandedDriverDates(new Set()); 
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors
                    ${selectedDriverId === driver.id ? 'bg-indigo-50 border-indigo-200 border' : 'hover:bg-gray-50 border border-transparent'}
                  `}
                >
                  <img src={driver.avatarUrl} alt="" className="w-8 h-8 rounded-full bg-gray-200" />
                  <div>
                    <span className={`block text-sm font-medium ${selectedDriverId === driver.id ? 'text-indigo-900' : 'text-gray-700'}`}>
                      {driver.name}
                    </span>
                    <span className={`text-xs ${textColorClass}`}>
                       {count} {labelText}
                    </span>
                  </div>
                </button>
              )})}
           </div>
        </div>

        {/* Driver Details Area */}
        <div className="md:col-span-8 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
           {selectedDriverId ? (
             <div className="flex flex-col h-full">
                <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                   <div>
                     <h3 className="text-lg font-bold text-gray-800">
                        {allDrivers.find(d => d.id === selectedDriverId)?.name}
                     </h3>
                     <p className="text-xs text-gray-500 mt-1">Histórico de Serviços</p>
                   </div>
                   <div className="text-right">
                     <span className="block text-xs text-gray-500">Saldo Devedor Total</span>
                     <span className="font-bold text-red-600 text-lg">R$ {selectedDriverLogs.reduce((acc, l) => acc + (l.checkedAndre ? 0 : l.totalLiquidCash), 0).toFixed(2)}</span>
                   </div>
                </div>
                                <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                   {Object.keys(groupedByDate).length > 0 ? (
                     Object.keys(groupedByDate).sort((a,b) => b.localeCompare(a)).map(date => {
                        const dayLogs = groupedByDate[date];
                        const dayDebt = dayLogs.reduce((acc, l) => acc + l.totalLiquidCash, 0);
                        const dayServicesCount = dayLogs.reduce((acc, l) => acc + (Array.isArray(l.services) ? l.services.length : 0), 0);
                        const isCheckedHudson = dayLogs.every(l => l.checkedHudson);
                        const isCheckedAndre = dayLogs.every(l => l.checkedAndre);
                        const isDateExpanded = expandedDriverDates.has(date);

                        return (
                           <div key={date} className="bg-white border border-gray-200 rounded-lg shadow-sm mb-3 overflow-hidden">
                              <div 
                                 className="px-4 py-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors"
                                 onClick={() => toggleSet(expandedDriverDates, date, setExpandedDriverDates)}
                              >
                                 <div className="flex items-center gap-1">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (isHudson || isSuperAdmin) toggleLogChecked(dayLogs.map(l => l.id), 'checkedHudson');
                                      }}
                                      title="Conferência Hudson (Serviços)"
                                      className={`p-1 rounded transition-colors ${isCheckedHudson ? 'text-blue-600' : 'text-gray-300'} ${isHudson || isSuperAdmin ? 'hover:text-gray-400' : 'cursor-not-allowed opacity-50'}`}
                                      disabled={!isHudson && !isSuperAdmin}
                                    >
                                      <Stamp className="w-5 h-5" />
                                    </button>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (isAndre || isSuperAdmin) toggleLogChecked(dayLogs.map(l => l.id), 'checkedAndre');
                                      }}
                                      title="Conferência André (Pagamento)"
                                      className={`p-1 rounded transition-colors ${isCheckedAndre ? 'text-green-600' : 'text-gray-300'} ${isAndre || isSuperAdmin ? 'hover:text-gray-400' : 'cursor-not-allowed opacity-50'}`}
                                      disabled={!isAndre && !isSuperAdmin}
                                    >
                                      {isCheckedAndre ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                                    </button>
                                    {isDateExpanded ? <ChevronDown className="w-4 h-4 text-indigo-500"/> : <ChevronRight className="w-4 h-4 text-gray-400"/>}
                                    <div>
                                       <span className="font-bold text-gray-800 flex items-center gap-1">
                                          {formatDateHeader(date).short}
                                          {formatDateHeader(date).full && (
                                             <span className="font-normal text-gray-500 text-sm capitalize">
                                                {formatDateHeader(date).full}
                                             </span>
                                          )}
                                       </span>
                                       <span className="text-xs text-gray-500">{dayServicesCount} Serviços registrados</span>
                                    </div>
                                 </div>
                                 <div className="flex flex-col items-end border-l border-gray-200 pl-3">
                                    <span className="text-[10px] uppercase text-gray-400 font-bold leading-none mb-1">
                                        {dayDebt < 0 ? 'A Receber (Admin)' : 'Pagar ao Admin'}
                                    </span>
                                    <span className={`font-bold ${dayDebt < 0 ? 'text-amber-600' : isCheckedAndre ? 'text-green-600' : 'text-red-600'}`}>R$ {Math.abs(dayDebt).toFixed(2)}</span>
                                 </div>
                              </div>
                              
                              {isDateExpanded && (
                                 <div>
                                    {dayLogs.map(log => (
                                       <LogDetailsContent key={log.id} log={log} />
                                    ))}
                                 </div>
                              )}
                           </div>
                        );
                     })
                   ) : (
                     <div className="text-center py-20 text-gray-400">
                       <FileText className="w-12 h-12 mx-auto mb-3 opacity-20"/>
                       <p>Nenhum registro encontrado para este motorista.</p>
                     </div>
                   )}
                </div>
             </div>
           ) : (
             <div className="flex flex-col items-center justify-center h-full text-gray-400 p-8 text-center">
                <Users className="w-16 h-16 mb-4 opacity-20" />
                <h3 className="text-lg font-medium text-gray-500">Selecione um motorista</h3>
                <p className="text-sm">Clique na lista ao lado para ver o histórico agrupado por datas.</p>
             </div>
           )}
        </div>
      </div>
    );
  };

  const renderCashServices = () => {
    // Filter logs for the selected date
    const dayLogs = logs.filter(l => l.date === cashTabDate);
    
    // We only want logs that have at least one service in DINHEIRO
    const logsWithCash = dayLogs.filter(l => 
      Array.isArray(l.services) && l.services.some(s => s.paymentMethod === 'DINHEIRO' || (s.paymentMethod as any) === 'CASH')
    );
    
    // Calculate totals for the day
    const totalCashServicesDay = logsWithCash.reduce((acc, l) => {
      const services = Array.isArray(l.services) ? l.services : [];
      return acc + services.filter(s => s.paymentMethod === 'DINHEIRO' || (s.paymentMethod as any) === 'CASH').reduce((sum, s) => sum + (Number(s.value) || 0), 0);
    }, 0);
    
    // "A Pagar ao Admin" total (which is the liquid cash total)
    const totalLiquidCashDay = logsWithCash.reduce((acc, l) => acc + l.totalLiquidCash, 0);

    return (
      <div className="space-y-4 animate-fade-in">
        {/* Header and Date Filter */}
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
           <div>
             <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
               <DollarSign className="w-5 h-5 text-green-600" />
               Serviços à Vista (Dinheiro)
             </h3>
             <p className="text-sm text-gray-500">
               Acompanhe o dinheiro físico arrecadado por motorista no dia.
             </p>
           </div>
           <div className="flex items-center gap-3 w-full sm:w-auto">
             <div className="bg-gray-100 p-2 rounded-lg flex items-center gap-2 flex-1 sm:flex-none">
               <Calendar className="w-4 h-4 text-gray-500" />
               <input
                 type="date"
                 value={cashTabDate}
                 onChange={(e) => setCashTabDate(e.target.value)}
                 className="bg-transparent border-none outline-none text-sm font-medium text-gray-700 w-full"
               />
             </div>
           </div>
        </div>

        {/* Totals KPI */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div className="bg-white rounded-xl shadow-sm border border-green-100 p-4 sm:p-6 border-l-4 border-l-green-500">
              <span className="block text-sm font-medium text-gray-500 mb-1">Total de Serviços (Dinheiro)</span>
              <span className="text-2xl font-bold text-gray-900">R$ {totalCashServicesDay.toFixed(2)}</span>
           </div>
           <div className="bg-white rounded-xl shadow-sm border border-indigo-100 p-4 sm:p-6 border-l-4 border-l-indigo-500">
              <span className="block text-sm font-medium text-gray-500 mb-1">Acerto Líquido (A Receber do Motorista)</span>
              <span className="text-2xl font-bold text-indigo-700">R$ {totalLiquidCashDay.toFixed(2)}</span>
           </div>
        </div>

        {/* Drivers List */}
        {logsWithCash.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-gray-500 shadow-sm border border-gray-100 flex flex-col items-center gap-2">
            <DollarSign className="w-8 h-8 text-gray-300 mx-auto" />
            <p>Nenhum serviço em dinheiro registrado para esta data.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {logsWithCash.map(log => {
              const services = Array.isArray(log.services) ? log.services : [];
              const cashServices = services.filter(s => s.paymentMethod === 'DINHEIRO' || (s.paymentMethod as any) === 'CASH');
              const totalExpenses = log.totalExpenses || 0;
              
              return (
                <div key={log.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                     <div className="flex items-center gap-3">
                       <UserIcon className="w-5 h-5 text-gray-400" />
                       <span className="font-bold text-gray-900">{log.driverName}</span>
                     </div>
                     <div className="text-right">
                       <span className="block text-xs text-gray-500">Acerto Final</span>
                       <span className={`font-bold ${log.totalLiquidCash < 0 ? 'text-amber-600' : 'text-green-600'}`}>
                         R$ {Math.abs(log.totalLiquidCash).toFixed(2)}
                         <span className="text-xs ml-1 font-normal">{log.totalLiquidCash < 0 ? '(A Reembolsar)' : '(A Pagar)'}</span>
                       </span>
                     </div>
                  </div>
                  <div className="p-4 flex-1">
                    <div className="space-y-3">
                      {cashServices.map((srv, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2 rounded-lg bg-green-50 border border-green-100">
                           <div>
                             <span className="font-medium text-gray-900 text-sm block">{srv.clientName || srv.destination}</span>
                             <span className="text-xs text-gray-500">{srv.towedVehicle} ({srv.towedPlate})</span>
                           </div>
                           <span className="font-bold text-green-700">+ R$ {Number(srv.value).toFixed(2)}</span>
                        </div>
                      ))}
                      
                      {totalExpenses > 0 && (
                        <div className="flex justify-between items-center p-2 rounded-lg bg-red-50 border border-red-100 mt-2">
                           <div className="flex items-center gap-2">
                             <Minus className="w-4 h-4 text-red-500" />
                             <span className="font-medium text-gray-900 text-sm">Despesas do Dia (Abatidas)</span>
                           </div>
                           <span className="font-bold text-red-700">- R$ {totalExpenses.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
       {/* Header */}
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
               <LayoutDashboard className="w-7 h-7 text-indigo-600" />
               Painel de Controle
            </h2>
            <p className="text-gray-500 text-sm">Visão geral da operação e desempenho.</p>
          </div>
          <div className="flex items-center gap-2">
             <button onClick={loadData} disabled={loadingData} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Atualizar Dados">
               <RefreshCw className={`w-5 h-5 ${loadingData ? 'animate-spin' : ''}`} />
             </button>
             {!(currentUser?.name?.toLowerCase().includes('hudson') || currentUser?.name?.toLowerCase().includes('andre')) && (
               <button onClick={() => setShowSetup(true)} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" title="Configurações">
                 <Settings className="w-5 h-5" />
               </button>
             )}
          </div>
       </div>

       {/* Tabs */}
       <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl w-fit">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'overview' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Visão Geral
          </button>
          <button 
            onClick={() => setActiveTab('dates')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'dates' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Por Data
          </button>
          <button 
            onClick={() => setActiveTab('drivers')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'drivers' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Motoristas
          </button>
          <button 
            onClick={() => setActiveTab('cash')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'cash' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <DollarSign className="w-4 h-4" />
            Serviços à Vista
          </button>
          <button 
            onClick={() => setActiveTab('refuel')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'refuel' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Droplet className="w-4 h-4" />
            Abastecimento
          </button>
          <button 
            onClick={() => setActiveTab('maintenance')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'maintenance' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Wrench className="w-4 h-4" />
            Manutenção
          </button>
       </div>

       {/* Content */}
       <div className="min-h-[500px]">
          {activeTab === 'overview' && renderOverview()}
          {activeTab === 'dates' && renderByDate()}
          {activeTab === 'drivers' && renderDrivers()}
          {activeTab === 'cash' && renderCashServices()}
          {activeTab === 'refuel' && <AdminRefuel />}
          {activeTab === 'maintenance' && <AdminMaintenance />}
       </div>

       {/* Modals */}
       {previewImage && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
           <div className="relative max-w-4xl w-full h-[90vh]" onClick={e => e.stopPropagation()}>
              {previewImage.startsWith('data:application/pdf') ? (
                <iframe src={previewImage} className="w-full h-full rounded-lg bg-white" title="Comprovante PDF" />
              ) : (
                <img src={previewImage} alt="Comprovante Full" className="w-full h-full object-contain rounded-lg" />
              )}
              <button className="absolute -top-4 -right-4 bg-white rounded-full p-2 shadow-lg" onClick={() => setPreviewImage(null)}>
                <X className="w-6 h-6 text-gray-900" />
              </button>
           </div>
        </div>
      )}

      {showSetup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
               <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Settings className="w-6 h-6 text-indigo-600"/> Configuração</h3>
               <button onClick={() => setShowSetup(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <p className="text-sm text-gray-600">
                <strong className="text-red-600">ATENÇÃO:</strong> O Script foi atualizado para suportar edições. Por favor, atualize no Google Apps Script.
              </p>
              <div className="relative">
                 <button onClick={copyCode} className="absolute right-2 top-2 text-xs bg-gray-800 text-white px-2 py-1 rounded hover:bg-gray-700">{copied ? 'Copiado!' : 'Copiar'}</button>
                 <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto h-64 font-mono">{GAS_SCRIPT_CODE}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-8 flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
               <div>
                  <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <Pencil className="w-6 h-6 text-indigo-600"/> Editando Relatório
                  </h3>
                  <p className="text-xs text-gray-500">Motorista: {editingLog.driverName} | Data: {new Date(editingLog.date).toLocaleDateString('pt-BR')}</p>
               </div>
               <button onClick={handleCloseEdit} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-8">
               
               {/* Header Fields */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Veículo</label>
                   <select 
                     value={editingLog.vehicleId} 
                     onChange={(e) => updateEditField('vehicleId', e.target.value)}
                     className="w-full rounded-lg border-gray-300 border p-2 bg-white text-gray-900"
                   >
                     {VEHICLES.map(v => (
                       <option key={v.id} value={v.id}>{v.name}</option>
                     ))}
                   </select>
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                   <input 
                      type="date"
                      value={editingLog.date}
                      onChange={(e) => updateEditField('date', e.target.value)}
                      className="w-full rounded-lg border-gray-300 border p-2 bg-white text-gray-900"
                   />
                 </div>
               </div>

               {/* Services Edit */}
               <div>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-bold text-gray-800">Serviços</h4>
                    <button type="button" onClick={addServiceInEdit} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"><Plus className="w-4 h-4"/> Adicionar Serviço</button>
                  </div>
                  
                  <div className="space-y-4">
                    {(editingLog.services || []).map((service, index) => (
                      <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4 relative">
                        <button onClick={() => removeServiceInEdit(index)} className="absolute top-2 right-2 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                           <div>
                              <label className="text-xs text-gray-500">Início</label>
                              <input type="time" value={service.startTime} onChange={(e) => updateServiceInEdit(index, 'startTime', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm bg-white text-gray-900"/>
                           </div>
                           <div>
                              <label className="text-xs text-gray-500">Fim</label>
                              <input type="time" value={service.endTime} onChange={(e) => updateServiceInEdit(index, 'endTime', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm bg-white text-gray-900"/>
                           </div>
                           <div>
                              <label className="text-xs text-gray-500">Valor (R$)</label>
                              <input type="number" value={service.value} onChange={(e) => updateServiceInEdit(index, 'value', Number(e.target.value))} className="w-full p-2 border border-gray-300 rounded text-sm bg-white text-gray-900"/>
                           </div>
                           <div>
                              <label className="text-xs text-gray-500">Cliente</label>
                              <input type="text" value={service.clientName} onChange={(e) => updateServiceInEdit(index, 'clientName', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm bg-white text-gray-900"/>
                           </div>
                           <div>
                              <label className="text-xs text-gray-500">Pagamento</label>
                              <select value={service.paymentMethod} onChange={(e) => updateServiceInEdit(index, 'paymentMethod', e.target.value)} className="w-full p-2 border border-gray-300 rounded text-sm bg-white text-gray-900">
                                {Object.values(PaymentMethod).map(m => <option key={m} value={m}>{m}</option>)}
                              </select>
                           </div>
                        </div>
                      </div>
                    ))}
                  </div>
               </div>

               {/* Expenses Edit */}
               <div>
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-bold text-gray-800">Despesas</h4>
                    <button type="button" onClick={addExpenseInEdit} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"><Plus className="w-4 h-4"/> Adicionar Despesa</button>
                  </div>
                  {(editingLog.expenses || []).map((expense, index) => (
                    <div key={index} className="flex gap-2 mb-2 items-center">
                       <input 
                        type="text" 
                        value={expense.description}
                        onChange={(e) => updateExpenseInEdit(index, 'description', e.target.value)}
                        className="flex-1 p-2 text-sm border border-gray-300 rounded bg-white text-gray-900"
                        placeholder="Descrição"
                       />
                       <input 
                        type="number" 
                        value={expense.value}
                        onChange={(e) => updateExpenseInEdit(index, 'value', Number(e.target.value))}
                        className="w-24 p-2 text-sm border border-gray-300 rounded bg-white text-gray-900"
                        placeholder="R$"
                       />
                       <button onClick={() => removeExpenseInEdit(index)} className="text-red-400"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  ))}
               </div>

               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                 <textarea 
                   rows={3} 
                   value={editingLog.observations}
                   onChange={(e) => updateEditField('observations', e.target.value)}
                   className="w-full rounded-lg border-gray-300 border p-2 bg-white text-gray-900"
                 ></textarea>
               </div>

            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
               <button onClick={handleCloseEdit} className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-200 rounded-lg transition-colors">Cancelar</button>
               <button 
                 onClick={handleSaveEdit} 
                 disabled={isSavingEdit}
                 className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
               >
                 {isSavingEdit ? 'Salvando...' : <><Save className="w-4 h-4"/> Salvar Alterações</>}
               </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;