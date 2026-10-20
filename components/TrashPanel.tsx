import React, { useEffect, useState } from 'react';
import { fetchTrash, restoreFromTrash, TrashItem, TRASH_DAYS } from '../services/storage';
import { VEHICLES } from '../constants';
import { Trash2, RotateCcw, Loader2, Droplet, FileText } from 'lucide-react';

const vehicleName = (id: string) => VEHICLES.find(v => v.id === id)?.name || id || '—';
const fmtDay = (d: string) => {
  const s = String(d || '').slice(0, 10);
  return s ? new Date(s + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
};
const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const summary = (it: TrashItem) => {
  const d = it.data || {};
  if (it.collection === 'abastecimentos') {
    return `${Number(d.liters || 0).toLocaleString('pt-BR')} L · R$ ${Number(d.total || 0).toFixed(2)} · ${d.station || ''}`;
  }
  const sv = Array.isArray(d.services) ? d.services.length : 0;
  const ex = Array.isArray(d.expenses) ? d.expenses.length : 0;
  return `${sv} serviço${sv === 1 ? '' : 's'} · ${ex} despesa${ex === 1 ? '' : 's'}`;
};

const TrashPanel: React.FC<{ onRestored?: () => void }> = ({ onRestored }) => {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setItems(await fetchTrash());
    } catch (e) {
      console.error('Erro ao carregar a lixeira', e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const restore = async (it: TrashItem) => {
    setBusyId(it.id);
    try {
      await restoreFromTrash(it.id);
      setItems(prev => prev.filter(x => x.id !== it.id));
      onRestored?.();
    } catch (e) {
      console.error(e);
      alert('Não foi possível restaurar. Verifique a conexão e tente de novo.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-indigo-600" /> Lixeira
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Registros e abastecimentos excluídos ficam aqui por {TRASH_DAYS} dias e podem ser restaurados com um clique.
        </p>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-500 flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" /> Carregando a lixeira...
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-500">
          A lixeira está vazia.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Tipo</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Motorista</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Dia</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Veículo</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Conteúdo</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Excluído por</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Some em</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(it => {
                const left = Math.max(0, TRASH_DAYS - Math.floor((Date.now() - new Date(it.deletedAt).getTime()) / 86400000));
                return (
                  <tr key={it.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {it.collection === 'abastecimentos'
                        ? <span className="inline-flex items-center gap-1 text-sky-700"><Droplet className="w-4 h-4" /> Abastecimento</span>
                        : <span className="inline-flex items-center gap-1 text-indigo-700"><FileText className="w-4 h-4" /> Registro diário</span>}
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-800">{it.data?.driverName || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtDay(it.data?.date)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{vehicleName(it.data?.vehicleId)}</td>
                    <td className="px-3 py-2 text-gray-600">{summary(it)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                      {it.deletedBy}<span className="block text-xs text-gray-400">{fmtWhen(it.deletedAt)}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-500">{left} dia{left === 1 ? '' : 's'}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => restore(it)}
                        disabled={busyId === it.id}
                        className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60"
                      >
                        {busyId === it.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                        Restaurar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default TrashPanel;
