import React, { useState, useEffect } from 'react';
import { User, DailyLog, ServiceItem, ExpenseItem, PaymentMethod } from '../types';
import { VEHICLES, getLocalDate } from '../constants';
import { saveLog, getLogsByUser } from '../services/storage';
import { Plus, Trash2, Save, Truck, DollarSign, Clock, MapPin, Loader2, CheckCircle, Camera, Image as ImageIcon, X, FileText } from 'lucide-react';
import Calendar from './Calendar';

import { v4 as uuidv4 } from 'uuid';

const generateId = () => uuidv4();

interface DriverFormProps {
  user: User;
  onSuccess: () => void;
}

const DriverForm: React.FC<DriverFormProps> = ({ user, onSuccess }) => {
  const [date, setDate] = useState(getLocalDate());
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [observations, setObservations] = useState('');
  
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [userLogs, setUserLogs] = useState<DailyLog[]>([]);
  const [savedServiceIds, setSavedServiceIds] = useState<Set<string>>(new Set());
  const [savedExpenseIds, setSavedExpenseIds] = useState<Set<string>>(new Set());
  const [existingLogId, setExistingLogId] = useState<string | null>(null);

  useEffect(() => {
    if (isSubmitting) return;
    
    const loadLogs = async () => {
      let logs = await getLogsByUser(user.id, user.name);
      
      logs = logs.map(log => {
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
        
        const calculatedTotalInvoiced = (log.services || []).reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
        const calculatedTotalExpenses = (log.expenses || []).reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
        const calculatedTotalLiquidTerm = (log.services || [])
          .filter(s => s.paymentMethod === 'A PRAZO')
          .reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
        const calculatedTotalLiquidCash = (log.services || [])
          .filter(s => s.paymentMethod === 'DINHEIRO')
          .reduce((acc, curr) => acc + (Number(curr.value) || 0), 0) - calculatedTotalExpenses;

        return {
          ...log,
          date: formattedDate,
          totalInvoiced: calculatedTotalInvoiced,
          totalExpenses: calculatedTotalExpenses,
          totalLiquidCash: calculatedTotalLiquidCash,
          totalLiquidTerm: calculatedTotalLiquidTerm,
          checkedAndre: isCheckedAndre,
          checkedHudson: isCheckedHudson,
          checked: isCheckedAndre
        };
      });

      setUserLogs(logs);
    };
    loadLogs();
  }, [user.id, user.name, showSuccessModal]);

  useEffect(() => {
      // Check if there is a log for the selected date AND vehicle
      const logForDateAndVehicle = userLogs.find(l => l.date === date && (selectedVehicle ? l.vehicleId === selectedVehicle : true));
      
      // If we are just starting and no vehicle is selected, try to find any log for that date to auto-select
      const anyLogForDate = userLogs.find(l => l.date === date);
      const logToLoad = logForDateAndVehicle || (selectedVehicle === '' ? anyLogForDate : null);
      
      if (logToLoad) {
        // If we found a log, load it (this overwrites current state)
        setExistingLogId(logToLoad.id);
        if (!selectedVehicle || logToLoad.vehicleId === selectedVehicle) {
          setSelectedVehicle(logToLoad.vehicleId);
        }
        setServices(logToLoad.services || []);
        setExpenses(logToLoad.expenses || []);
        setObservations(logToLoad.observations);
        setSavedServiceIds(new Set((logToLoad.services || []).map(s => s.id)));
        setSavedExpenseIds(new Set((logToLoad.expenses || []).map(e => e.id)));
      } else {
        // No log found for this combination.
        // If we were previously looking at a SAVED log, we should clear the form to start fresh.
        // If we were already in a NEW log (existingLogId === null), we keep the current services/expenses 
        // because the user is likely just correcting the date/vehicle of their current draft.
        if (existingLogId !== null) {
          setExistingLogId(null);
          setServices([]);
          setExpenses([]);
          setObservations('');
          setSavedServiceIds(new Set());
          setSavedExpenseIds(new Set());
        }
      }
  }, [date, selectedVehicle, userLogs, existingLogId]);

  // Calculations
  const totalInvoiced = services.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
  const totalExpenses = expenses.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
  
  // Breakdown
  const totalLiquidTerm = services
    .filter(s => s.paymentMethod === PaymentMethod.ON_TERM)
    .reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);
    
  const totalLiquidCash = services
    .filter(s => s.paymentMethod === PaymentMethod.CASH || (s.paymentMethod as any) === 'DINHEIRO')
    .reduce((acc, curr) => acc + (Number(curr.value) || 0), 0) - totalExpenses;

  // Image Compression Utility
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 900; // Resize to max 900px width for better legibility
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
          
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          // Compress to JPEG with 0.7 quality
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };

  const handleImageUpload = async (id: string, file: File) => {
    try {
      if (file.type === 'application/pdf') {
        if (file.size > 2 * 1024 * 1024) { // 2MB limit for PDF
           alert("PDF muito grande (máximo 2MB).");
           return;
        }
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          setServices(services.map(s => s.id === id ? { ...s, proofImage: reader.result as string } : s));
        };
        return;
      }
      const base64 = await compressImage(file);
      setServices(services.map(s => s.id === id ? { ...s, proofImage: base64 } : s));
    } catch (error) {
      alert("Erro ao processar o arquivo. Tente novamente.");
    }
  };

  const removeImage = (id: string) => {
    setServices(services.map(s => s.id === id ? { ...s, proofImage: undefined } : s));
  };

  const addServiceRow = () => {
    setServices([
      ...services,
      {
        id: generateId(),
        startTime: '',
        endTime: '',
        departure: '',
        destination: '',
        towedVehicle: '',
        towedPlate: '',
        clientName: '',
        clientPhone: '',
        paymentMethod: PaymentMethod.CASH,
        value: 0
      }
    ]);
  };

  const removeServiceRow = (id: string) => {
    setServices(services.filter(s => s.id !== id));
  };

  const updateService = (id: string, field: keyof ServiceItem, value: any) => {
    setServices(services.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handlePaymentChange = (id: string, method: PaymentMethod) => {
    setServices(services.map(s => {
      if (s.id === id) {
        return {
          ...s,
          paymentMethod: method,
          value: method === PaymentMethod.ON_TERM ? 0 : s.value,
          // Se mudou para A PRAZO, remove a imagem pois não é obrigatória
          proofImage: method === PaymentMethod.ON_TERM ? undefined : s.proofImage 
        };
      }
      return s;
    }));
  };

  const addExpenseRow = () => {
    setExpenses([...expenses, { id: generateId(), description: '', value: 0 }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedVehicle) {
      alert("Por favor, selecione um veículo.");
      return;
    }

    // Validation: Value required for non-term payments
    const hasInvalidValue = services.some(service => {
      const isTerm = service.paymentMethod === PaymentMethod.ON_TERM;
      const hasValue = service.value && service.value > 0;
      return !isTerm && !hasValue;
    });

    if (hasInvalidValue) {
      alert("Para pagamentos à vista, o valor do serviço é obrigatório.");
      return;
    }

    // Validation: Image required for non-term payments
    const hasMissingProof = services.some(service => {
      const isTerm = service.paymentMethod === PaymentMethod.ON_TERM;
      return !isTerm && !service.proofImage;
    });

    if (hasMissingProof) {
      alert("Para pagamentos À VISTA (Dinheiro, Pix, Cartão), é obrigatório anexar a foto do valor/comprovante.");
      return;
    }

    setIsSubmitting(true);

    const log: DailyLog = {
      id: existingLogId || generateId(),
      userId: user.id,
      driverName: user.name,
      date,
      vehicleId: selectedVehicle,
      // kmStart e kmEnd removidos
      services,
      expenses,
      observations,
      totalInvoiced,
      totalLiquidCash,
      totalLiquidTerm,
      totalExpenses,
      submittedAt: new Date().toISOString()
    };

    try {
      // 1. Save to Firestore
      await saveLog(log);

      setIsSubmitting(false);
      setShowSuccessModal(true);
    } catch (error) {
      console.error("Erro ao salvar log:", error);
      alert("Ocorreu um erro ao salvar o relatório. Por favor, tente novamente.");
      setIsSubmitting(false);
    }
  };

  const finishProcess = () => {
    setShowSuccessModal(false);
    onSuccess(); // Reset or redirect
  };

  if (showSuccessModal) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-xl">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Relatório Enviado!</h3>
          <p className="text-gray-600 mb-6">
            Os dados foram salvos com sucesso.
            {/* Removed Google Sheets warning */}
          </p>
          <button 
            onClick={finishProcess}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl"
          >
            OK, Fechar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="mb-6 border-b pb-4">
           <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
             <Truck className="w-6 h-6 text-indigo-600" />
             Controle Diário de Serviços
           </h2>
        </div>

        {/* Header Fields (KM Removido) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
            <input 
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)}
              className={`w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border text-gray-900 bg-white`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Veículo (Guincho)</label>
            <select 
              value={selectedVehicle} 
              onChange={(e) => setSelectedVehicle(e.target.value)}
              className={`w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border text-gray-900 bg-white`}
            >
              <option value="">Selecione...</option>
              {VEHICLES.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Services Grid - Responsive */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Serviços Realizados</h3>
            <button 
              type="button" 
              onClick={addServiceRow}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Plus className="w-4 h-4 mr-1" /> Adicionar Serviço
            </button>
          </div>

          <div className="space-y-4">
            {services.length === 0 && (
              <div className="text-center py-10 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <p className="text-gray-500">Nenhum serviço registrado hoje.</p>
              </div>
            )}

            {services.map((service, index) => {
              const isSaved = savedServiceIds.has(service.id);
              return (
                <div key={service.id} className={`bg-gray-50 rounded-lg p-4 border border-gray-200 shadow-sm relative animate-fade-in-up ${isSaved ? 'opacity-90 border-green-100' : ''}`}>
                  {isSaved ? (
                    <div className="absolute top-2 right-2 flex items-center gap-1 text-green-600 text-[10px] font-bold bg-green-50 px-2 py-0.5 rounded border border-green-200">
                       <CheckCircle className="w-3 h-3" /> REGISTRADO
                    </div>
                  ) : (
                    <div className="absolute top-2 right-2">
                       <button onClick={() => removeServiceRow(service.id)} className="text-red-400 hover:text-red-600">
                         <Trash2 className="w-5 h-5" />
                       </button>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Row 1 */}
                    <div>
                      <label className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3"/> Início</label>
                      <input type="time" value={service.startTime} disabled={isSaved} onChange={(e) => updateService(service.id, 'startTime', e.target.value)} className={`w-full p-2 text-sm border border-gray-300 rounded mt-1 text-gray-900 ${isSaved ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3"/> Fim</label>
                      <input type="time" value={service.endTime} disabled={isSaved} onChange={(e) => updateService(service.id, 'endTime', e.target.value)} className={`w-full p-2 text-sm border border-gray-300 rounded mt-1 text-gray-900 ${isSaved ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3"/> Saída</label>
                      <input type="text" placeholder="Local de Saída" value={service.departure} disabled={isSaved} onChange={(e) => updateService(service.id, 'departure', e.target.value)} className={`w-full p-2 text-sm border border-gray-300 rounded mt-1 text-gray-900 ${isSaved ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`} />
                    </div>
                     <div>
                      <label className="text-xs text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3"/> Destino</label>
                      <input type="text" placeholder="Local de Destino" value={service.destination} disabled={isSaved} onChange={(e) => updateService(service.id, 'destination', e.target.value)} className={`w-full p-2 text-sm border border-gray-300 rounded mt-1 text-gray-900 ${isSaved ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`} />
                    </div>

                    {/* Row 2 */}
                     <div>
                       <label className="text-xs text-gray-500">Veículo Rebocado</label>
                      <input type="text" placeholder="Modelo/Cor" value={service.towedVehicle} disabled={isSaved} onChange={(e) => updateService(service.id, 'towedVehicle', e.target.value.toUpperCase())} className={`w-full p-2 text-sm border border-gray-300 rounded mt-1 uppercase text-gray-900 ${isSaved ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`} />
                    </div>
                     <div>
                       <label className="text-xs text-gray-500">Placa</label>
                      <input type="text" placeholder="ABC-1234" value={service.towedPlate} disabled={isSaved} onChange={(e) => updateService(service.id, 'towedPlate', e.target.value.toUpperCase())} className={`w-full p-2 text-sm border border-gray-300 rounded mt-1 uppercase text-gray-900 ${isSaved ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Cliente</label>
                      <input type="text" placeholder="Nome" value={service.clientName} disabled={isSaved} onChange={(e) => updateService(service.id, 'clientName', e.target.value)} className={`w-full p-2 text-sm border border-gray-300 rounded mt-1 text-gray-900 ${isSaved ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`} />
                    </div>
                    
                     {/* Payment */}
                     <div>
                      <label className="text-xs text-gray-500 font-medium">Pagamento</label>
                      <select 
                        value={service.paymentMethod} 
                        disabled={isSaved}
                        onChange={(e) => handlePaymentChange(service.id, e.target.value as PaymentMethod)} 
                        className={`w-full p-2 text-sm border border-gray-300 rounded mt-1 text-gray-900 focus:ring-indigo-500 focus:border-indigo-500 ${isSaved ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                      >
                        {Object.values(PaymentMethod).map(m => (
                          <option key={m} value={m} className="text-gray-900 bg-white">
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                     {/* Value */}
                     <div>
                      <label className="text-xs text-gray-500 font-medium">Valor (R$)</label>
                      <input 
                        type="number" 
                        placeholder={service.paymentMethod === PaymentMethod.ON_TERM ? "Bloqueado" : "0.00"}
                        value={service.value === 0 ? '' : service.value} 
                        disabled={isSaved || service.paymentMethod === PaymentMethod.ON_TERM}
                        onChange={(e) => updateService(service.id, 'value', Number(e.target.value))} 
                        className={`w-full p-2 text-sm border rounded mt-1 font-semibold transition-colors 
                          ${isSaved || service.paymentMethod === PaymentMethod.ON_TERM 
                            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
                            : 'bg-white text-green-700 border-gray-300'}
                          ${!isSaved && service.paymentMethod !== PaymentMethod.ON_TERM && (!service.value || service.value <= 0) ? 'border-red-300 bg-red-50' : ''}
                        `}
                      />
                    </div>
                    
                    {/* Photo Proof for Cash/Immediate Payments */}
                    {service.paymentMethod !== PaymentMethod.ON_TERM && (
                      <div className="lg:col-span-3">
                        <label className="text-xs text-gray-500 font-medium mb-1 block">Foto do Valor/Comprovante (Obrigatório)</label>
                        {!service.proofImage ? (
                          <div className="relative">
                             <input 
                               type="file" 
                               accept="image/*,application/pdf" 
                               id={`proof-${service.id}`}
                               disabled={isSaved}
                               className="hidden"
                               onChange={(e) => e.target.files && handleImageUpload(service.id, e.target.files[0])}
                             />
                             <label 
                               htmlFor={`proof-${service.id}`}
                               className={`flex items-center justify-center gap-2 w-full p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 transition-colors ${isSaved ? 'bg-gray-100 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50 hover:border-indigo-400'}`}
                             >
                                <Camera className="w-5 h-5"/>
                                <span className="text-sm">Anexar Comprovante</span>
                             </label>
                          </div>
                        ) : (
                          <div className="relative inline-block mt-1 group">
                             {service.proofImage.startsWith('data:application/pdf') ? (
                               <div className="h-20 w-20 flex flex-col items-center justify-center bg-gray-100 rounded border border-gray-300 text-gray-500">
                                  <FileText className="w-8 h-8 text-red-500" />
                                  <span className="text-[10px] mt-1 font-bold">PDF</span>
                               </div>
                             ) : (
                               <img src={service.proofImage} alt="Comprovante" className="h-20 w-auto rounded border border-gray-300 shadow-sm" />
                             )}
                             {!isSaved && (
                               <button 
                                 onClick={() => removeImage(service.id)}
                                 className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600"
                                 title="Remover foto"
                               >
                                 <X className="w-3 h-3" />
                               </button>
                             )}
                             <span className="text-xs text-green-600 flex items-center gap-1 mt-1"><CheckCircle className="w-3 h-3"/> Anexado</span>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Expenses & Observations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 border-t pt-6">
           <div>
              <div className="flex justify-between items-center mb-2">
                 <h3 className="text-lg font-semibold text-gray-800">Despesas</h3>
                 <button type="button" onClick={addExpenseRow} className="text-sm text-indigo-600 font-medium">+ Adicionar</button>
              </div>
              {expenses.map(expense => {
                const isSavedExpense = savedExpenseIds.has(expense.id);
                return (
                  <div key={expense.id} className="flex gap-2 mb-2 items-center">
                     <input 
                      type="text" 
                      placeholder="Descrição (ex: Diesel)" 
                      value={expense.description}
                      disabled={isSavedExpense}
                      onChange={(e) => setExpenses(expenses.map(ex => ex.id === expense.id ? { ...ex, description: e.target.value} : ex))}
                      className={`flex-1 p-2 text-sm border border-gray-300 rounded text-gray-900 ${isSavedExpense ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                     />
                     <input 
                      type="number" 
                      placeholder="R$" 
                      value={expense.value === 0 ? '' : expense.value}
                      disabled={isSavedExpense}
                      onChange={(e) => setExpenses(expenses.map(ex => ex.id === expense.id ? { ...ex, value: Number(e.target.value)} : ex))}
                      className={`w-24 p-2 text-sm border border-gray-300 rounded text-gray-900 ${isSavedExpense ? 'bg-gray-100 cursor-not-allowed font-semibold' : 'bg-white'}`}
                     />
                     {!isSavedExpense && (
                       <button 
                         type="button" 
                         onClick={() => setExpenses(expenses.filter(e => e.id !== expense.id))}
                         className="text-red-400 hover:text-red-600 p-1"
                       >
                         <Trash2 className="w-4 h-4" />
                       </button>
                     )}
                     {isSavedExpense && (
                       <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                     )}
                  </div>
                );
              })}
              <div className="mt-4">
                 <label className="block text-sm font-medium text-gray-700 mb-1">Observações Gerais</label>
                 <textarea 
                   rows={3} 
                   value={observations}
                   onChange={(e) => setObservations(e.target.value)}
                   className={`w-full rounded-lg border-gray-300 border shadow-sm p-2 text-sm text-gray-900 bg-white`}
                   placeholder="Avarias, incidentes, notas..."
                 ></textarea>
              </div>
           </div>

           {/* Summary Card */}
           <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600"/> Resumo do Dia
              </h3>
              
              <div className="space-y-3">
                 <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Faturamento (Bruto)</span>
                    <span className="font-semibold">R$ {totalInvoiced.toFixed(2)}</span>
                 </div>
                 <div className="flex justify-between text-sm">
                    <span className="text-red-500">Despesas Gastas</span>
                    <span className="font-semibold text-red-500">- R$ {totalExpenses.toFixed(2)}</span>
                 </div>
                 <div className="border-t border-gray-300 my-2"></div>
                 <div className="flex justify-between text-base">
                    <span className="text-green-700 font-bold">Receita Líquida (Empresa)</span>
                    <span className="font-bold text-green-700">R$ {(totalInvoiced - totalExpenses).toFixed(2)}</span>
                 </div>
                 <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Faturado (A Prazo)</span>
                    <span className="font-medium text-blue-600">R$ {totalLiquidTerm.toFixed(2)}</span>
                 </div>
                 <div className={`flex justify-between text-lg font-bold p-3 rounded-lg ${totalLiquidCash < 0 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                    <span>{totalLiquidCash < 0 ? 'A Receber (Admin)' : 'Pagar ao Admin'}</span>
                    <span>R$ {Math.abs(totalLiquidCash).toFixed(2)}</span>
                 </div>
              </div>
           </div>
        </div>

        {/* Submit Action */}
        <div className="mt-8 pt-4 border-t flex justify-end">
           <button 
             onClick={handleSubmit}
             disabled={isSubmitting}
             className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:scale-100"
           >
             {isSubmitting ? (
               <><Loader2 className="w-5 h-5 animate-spin" /> Enviando...</>
             ) : (
               <><Save className="w-5 h-5" /> {existingLogId ? 'Atualizar Relatório' : 'Enviar Relatório'}</>
             )}
           </button>
        </div>

      </div>

      {/* Calendário de Preenchimento */}
      <Calendar logs={userLogs} />
    </div>
  );
};

export default DriverForm;