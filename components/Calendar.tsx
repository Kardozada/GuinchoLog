import React, { useMemo, useState } from 'react';
import { DailyLog, PaymentMethod } from '../types';
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, X, Clock, MapPin, DollarSign, Truck } from 'lucide-react';

interface CalendarProps {
  logs: DailyLog[];
}

const Calendar: React.FC<CalendarProps> = ({ logs }) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const today = new Date();
  const [currentDate, setCurrentDate] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();

  const logsByDate = useMemo(() => {
    const map: Record<string, 'paid' | 'success'> = {};
    
    // Group logs by date first
    const grouped: Record<string, DailyLog[]> = {};
    logs.forEach(log => {
      if (!grouped[log.date]) grouped[log.date] = [];
      grouped[log.date].push(log);
    });

    // Determine status for each date
    Object.keys(grouped).forEach(date => {
      const dayLogs = grouped[date];
      const allPaid = dayLogs.every(l => l.checkedAndre);
      map[date] = allPaid ? 'paid' : 'success';
    });
    
    return map;
  }, [logs]);

  const calendarDays = useMemo(() => {
    const days = [];
    // Add empty slots for the first week
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }
    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  }, [firstDayOfMonth, daysInMonth]);

  const getDayStatus = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const logStatus = logsByDate[dateStr];
    
    const checkDate = new Date(currentYear, currentMonth, day);
    const isPastOrToday = checkDate <= today;

    if (logStatus) return logStatus; // 'paid' or 'success'
    if (isPastOrToday) return 'missing';
    return 'future';
  };

  const selectedLogs = useMemo(() => {
    if (!selectedDate) return [];
    return logs.filter(log => log.date === selectedDate);
  }, [selectedDate, logs]);

  const handleDayClick = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayLogs = logs.filter(log => log.date === dateStr);
    if (dayLogs.length > 0) {
      setSelectedDate(dateStr);
      setShowDetails(true);
    }
  };

  const daySummary = useMemo(() => {
    if (selectedLogs.length === 0) return null;
    
    const totalInvoiced = selectedLogs.reduce((acc, l) => acc + l.totalInvoiced, 0);
    const totalExpenses = selectedLogs.reduce((acc, l) => acc + l.totalExpenses, 0);
    const totalLiquidCash = selectedLogs.reduce((acc, l) => acc + l.totalLiquidCash, 0);
    const totalLiquidTerm = selectedLogs.reduce((acc, l) => acc + l.totalLiquidTerm, 0);
    
    return { totalInvoiced, totalExpenses, totalLiquidCash, totalLiquidTerm };
  }, [selectedLogs]);

  const monthlySummary = useMemo(() => {
     const currentMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
     const monthLogs = logs.filter(log => log.date.startsWith(currentMonthStr));
     // Only sum the logs that have NOT been checked by Andre (not paid yet)
     const pendingLogs = monthLogs.filter(log => !log.checkedAndre);
     return pendingLogs.reduce((acc, l) => acc + l.totalLiquidCash, 0);
  }, [logs, currentMonth, currentYear]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-2">
           <button onClick={handlePrevMonth} className="p-1 rounded-full hover:bg-gray-100"><ChevronLeft className="w-5 h-5 text-gray-600"/></button>
           <h3 className="text-lg font-bold text-gray-800">
             Resumo - {monthNames[currentMonth]} {currentYear}
           </h3>
           <button onClick={handleNextMonth} className="p-1 rounded-full hover:bg-gray-100"><ChevronRight className="w-5 h-5 text-gray-600"/></button>
        </div>
        
        <div className={`px-4 py-2 rounded-lg border font-bold flex flex-col md:items-end ${monthlySummary < 0 ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-green-100 text-green-800 border-green-200'}`}>
           <span className="text-xs uppercase opacity-80 leading-tight">
              {monthlySummary < 0 ? 'Total a Receber (do Admin)' : 'Total a Pagar (ao Admin)'}
           </span>
           <span className="text-lg leading-tight">R$ {Math.abs(monthlySummary).toFixed(2)}</span>
        </div>
        
        <div className="flex gap-4 text-xs font-medium self-start md:self-auto">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Preenchido</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span>Anotado por André</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>Pendente</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
          <div key={day} className="text-center text-xs font-bold text-gray-400 uppercase py-2">
            {day}
          </div>
        ))}
        
        {calendarDays.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="aspect-square"></div>;
          }

          const status = getDayStatus(day);
          const isToday = day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();

          return (
            <div 
              key={day}
              onClick={() => handleDayClick(day)}
              className={`
                aspect-square flex flex-col items-center justify-center rounded-lg border transition-all relative
                ${status === 'success' ? 'bg-green-500 border-green-600 text-white shadow-sm cursor-pointer hover:scale-105' : ''}
                ${status === 'paid' ? 'bg-blue-500 border-blue-600 text-white shadow-sm cursor-pointer hover:scale-105' : ''}
                ${status === 'missing' ? 'bg-red-500 border-red-600 text-white shadow-sm' : ''}
                ${status === 'future' ? 'bg-gray-50 border-gray-100 text-gray-300' : ''}
                ${isToday ? 'ring-2 ring-indigo-400 ring-offset-2' : ''}
              `}
            >
              <span className="text-sm font-bold">{day}</span>
              {status === 'success' && <CheckCircle2 className="w-3 h-3 mt-1 opacity-80" />}
              {status === 'paid' && <CheckCircle2 className="w-3 h-3 mt-1 opacity-80" />}
              {status === 'missing' && <XCircle className="w-3 h-3 mt-1 opacity-80" />}
            </div>
          );
        })}
      </div>
      
      <div className="mt-6 p-4 bg-indigo-50 rounded-lg border border-indigo-100">
        <p className="text-sm text-indigo-800 leading-relaxed">
          <strong>Dica:</strong> Mantenha seu calendário sempre verde! Isso ajuda na organização dos seus pagamentos e no controle da frota.
        </p>
      </div>

      {/* Details Modal */}
      {showDetails && selectedDate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50 rounded-t-2xl">
               <div>
                  <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <CheckCircle2 className="w-6 h-6 text-green-600"/> Detalhes do Dia
                  </h3>
                  <p className="text-sm text-gray-500">Data: {new Date(selectedDate).toLocaleDateString('pt-BR')}</p>
               </div>
               <button onClick={() => setShowDetails(false)} className="text-gray-400 hover:text-gray-600 p-2">
                 <X className="w-6 h-6" />
               </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-8">
              {selectedLogs.map((log, logIdx) => (
                <div key={log.id} className="space-y-4">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <Truck className="w-5 h-5 text-indigo-600" />
                    <h4 className="font-bold text-gray-800">Veículo: {log.vehicleId}</h4>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {log.services.map((service, sIdx) => (
                      <div key={service.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-xs text-gray-400 block">Horário</span>
                            <span className="font-medium text-gray-700 flex items-center gap-1">
                              <Clock className="w-3 h-3"/> {service.startTime} - {service.endTime}
                            </span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400 block">Cliente</span>
                            <span className="font-medium text-gray-700">{service.clientName || '-'}</span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400 block">Pagamento</span>
                            <span className="font-medium text-gray-700">{service.paymentMethod}</span>
                          </div>
                          <div>
                            <span className="text-xs text-gray-400 block">Valor</span>
                            <span className="font-bold text-green-600">R$ {service.value.toFixed(2)}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-xs text-gray-400 block">Trajeto</span>
                            <span className="text-gray-600 flex items-center gap-1">
                              <MapPin className="w-3 h-3"/> {service.departure} → {service.destination}
                            </span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-xs text-gray-400 block">Veículo Rebocado</span>
                            <span className="text-gray-600">{service.towedVehicle} ({service.towedPlate})</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {log.expenses.length > 0 && (
                    <div className="mt-4">
                      <h5 className="text-sm font-bold text-gray-700 mb-2">Despesas</h5>
                      <div className="space-y-1">
                        {log.expenses.map(expense => (
                          <div key={expense.id} className="flex justify-between text-sm bg-red-50 p-2 rounded border border-red-100">
                            <span className="text-red-700">{expense.description}</span>
                            <span className="font-bold text-red-700">R$ {expense.value.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {log.observations && (
                    <div className="mt-4 p-3 bg-gray-50 rounded border border-gray-200 text-sm italic text-gray-600">
                      <strong>Obs:</strong> {log.observations}
                    </div>
                  )}
                </div>
              ))}

              {daySummary && (
                <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 mt-8">
                  <h3 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-indigo-600"/> Resumo Financeiro do Dia
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm">
                        <span className="text-xs text-gray-500 block">Total Faturado</span>
                        <span className="text-lg font-bold text-gray-800">R$ {daySummary.totalInvoiced.toFixed(2)}</span>
                     </div>
                     <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm">
                        <span className="text-xs text-gray-500 block text-red-500">Total Despesas</span>
                        <span className="text-lg font-bold text-red-600">R$ {daySummary.totalExpenses.toFixed(2)}</span>
                     </div>
                     <div className="bg-white p-3 rounded-lg border border-indigo-100 shadow-sm">
                        <span className="text-xs text-gray-500 block text-blue-500">Líquido (A Prazo)</span>
                        <span className="text-lg font-bold text-blue-600">R$ {daySummary.totalLiquidTerm.toFixed(2)}</span>
                     </div>
                     <div className="bg-green-600 p-3 rounded-lg border border-green-700 shadow-sm text-white">
                        <span className="text-xs opacity-80 block">Líquido (À Vista)</span>
                        <span className="text-lg font-bold">R$ {daySummary.totalLiquidCash.toFixed(2)}</span>
                     </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-6 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end">
               <button 
                 onClick={() => setShowDetails(false)}
                 className="bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-6 rounded-lg transition-colors"
               >
                 Fechar
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
