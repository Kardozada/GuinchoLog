import React, { useEffect, useMemo, useState } from 'react';
import { DailyLog } from '../types';
import { fetchMarks, MarkEvent } from '../services/storage';
import { VEHICLES } from '../constants';
import { CheckSquare, Loader2, RefreshCw, Square, Stamp } from 'lucide-react';

type Who = '' | 'checkedAndre' | 'checkedHudson';
const QUEM: Record<MarkEvent['campo'], string> = { checkedAndre: 'Check (André)', checkedHudson: 'Carimbo (Hudson)' };
const vName = (id?: string) => (id ? VEHICLES.find(v => v.id === id)?.name || id : '');
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const diaBR = (d?: string) => (d ? new Date(String(d).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR') : '');

// Histórico de cada clique nos quadrados de conferência (check de André e
// carimbo de Hudson). Antes de o histórico existir, só o último clique de cada
// registro ficou guardado — esses aparecem como "último registro".
const MarksPanel: React.FC<{ logs: DailyLog[] }> = ({ logs }) => {
  const [dia, setDia] = useState(() => new Date().toLocaleDateString('sv-SE'));
  const [marks, setMarks] = useState<MarkEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [who, setWho] = useState<Who>('');

  const load = async () => {
    setLoading(true);
    try { setMarks(await fetchMarks(dia)); } catch (e) { console.error(e); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [dia]);

  const rows = useMemo(() => {
    const seen = new Set(marks.map(m => `${m.campo}|${m.logId}|${m.at}`));
    const imported: MarkEvent[] = [];
    logs.forEach(l => {
      (['checkedAndre', 'checkedHudson'] as const).forEach(campo => {
        const at = (l as any)[`${campo}At`] as string | undefined;
        if (!at || new Date(at).toLocaleDateString('sv-SE') !== dia || seen.has(`${campo}|${l.id}|${at}`)) return;
        imported.push({
          id: `imp_${campo}_${l.id}`, logId: l.id, campo, valor: !!l[campo], por: (l as any)[`${campo}By`] || '?', at,
          driverName: l.driverName, date: l.date, vehicleId: l.vehicleId, importado: true,
        });
      });
    });
    const byLog = new Map(logs.map(l => [l.id, l]));
    return [...marks, ...imported]
      .map(m => ({ ...m, driverName: m.driverName || byLog.get(m.logId)?.driverName, vehicleId: m.vehicleId || byLog.get(m.logId)?.vehicleId }))
      .filter(m => !who || m.campo === who)
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [marks, logs, dia, who]);

  const count = (c: MarkEvent['campo'], v: boolean) => rows.filter(r => r.campo === c && r.valor === v).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2"><CheckSquare className="w-5 h-5 text-indigo-600" /> Marcações de conferência</h1>
          <p className="text-sm text-gray-500 mt-0.5">Cada vez que alguém marcou ou desmarcou o check de André ou o carimbo de Hudson. Guardado para sempre.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={who} onChange={e => setWho(e.target.value as Who)} className="p-2 border border-gray-300 rounded-lg text-sm">
            <option value="">André e Hudson</option>
            <option value="checkedAndre">Só check de André</option>
            <option value="checkedHudson">Só carimbo de Hudson</option>
          </select>
          <input type="date" value={dia} onChange={e => setDia(e.target.value)} className="p-2 border border-gray-300 rounded-lg text-sm" />
          <button onClick={load} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Atualizar"><RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      {!loading && rows.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 rounded bg-blue-50 text-blue-800">André: {count('checkedAndre', true)} marcou · {count('checkedAndre', false)} desmarcou</span>
          <span className="px-2 py-1 rounded bg-gray-100 text-gray-800">Hudson: {count('checkedHudson', true)} carimbou · {count('checkedHudson', false)} tirou</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        {loading ? (
          <div className="p-10 text-center text-gray-500 flex flex-col items-center gap-3"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /> Carregando...</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-gray-500">Nenhuma marcação neste dia.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">Hora</th>
                <th className="text-left px-3 py-2">Quem clicou</th>
                <th className="text-left px-3 py-2">Ação</th>
                <th className="text-left px-3 py-2">Motorista</th>
                <th className="text-left px-3 py-2">Dia do registro</th>
                <th className="text-left px-3 py-2">Veículo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(m => (
                <tr key={m.id} className={m.valor ? '' : 'bg-red-50/60'}>
                  <td className="px-3 py-2 tabular-nums whitespace-nowrap">{hora(m.at)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{m.por}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 font-medium ${m.valor ? (m.campo === 'checkedAndre' ? 'text-blue-700' : 'text-gray-800') : 'text-red-700'}`}>
                      {m.campo === 'checkedHudson' ? <Stamp className="w-4 h-4" /> : m.valor ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                      {m.valor ? 'Marcou' : 'Desmarcou'} · {QUEM[m.campo]}
                    </span>
                    {m.importado && <span className="block text-[11px] text-gray-400">último registro (antes do histórico completo)</span>}
                  </td>
                  <td className="px-3 py-2">{m.driverName || '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{diaBR(m.date)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{vName(m.vehicleId)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default MarksPanel;
