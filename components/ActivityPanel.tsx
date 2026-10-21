import React, { useEffect, useMemo, useState } from 'react';
import { fetchActivity, purgeOldActivity, ActivityEvent, ACTIVITY_DAYS } from '../services/diagnostics';
import { VEHICLES } from '../constants';
import { Activity, Loader2, RefreshCw, Wifi, WifiOff } from 'lucide-react';

type Tone = 'ok' | 'erro' | 'aviso' | 'info' | 'neutro' | 'alerta';
const LABELS: Record<string, [string, Tone]> = {
  app_aberto: ['Abriu o app', 'neutro'],
  saiu_do_app: ['Saiu do app (outra tela, câmera ou bloqueou o celular)', 'neutro'],
  voltou_ao_app: ['Voltou ao app', 'neutro'],
  servico_adicionado: ['Adicionou um serviço', 'info'],
  despesa_adicionada: ['Adicionou uma despesa', 'info'],
  foto_escolhida: ['Escolheu a foto do comprovante', 'info'],
  foto_anexada: ['Foto do comprovante anexada', 'info'],
  foto_erro: ['Erro com a foto', 'erro'],
  envio_tocado: ['Tocou em enviar', 'info'],
  envio_ok: ['Enviado com sucesso', 'ok'],
  envio_erro: ['Falha no envio', 'erro'],
  aviso: ['Recebeu um aviso', 'aviso'],
  rascunho_recuperado: ['Rascunho recuperado (o app tinha fechado sem enviar)', 'alerta'],
};
const TONE: Record<Tone, string> = {
  ok: 'bg-green-50 border-green-200 text-green-800',
  erro: 'bg-red-50 border-red-200 text-red-800',
  aviso: 'bg-amber-50 border-amber-200 text-amber-900',
  alerta: 'bg-sky-50 border-sky-200 text-sky-900',
  info: 'bg-indigo-50 border-indigo-100 text-indigo-900',
  neutro: 'bg-gray-50 border-gray-200 text-gray-700',
};
const vName = (id?: string) => (id ? VEHICLES.find(v => v.id === id)?.name || id : '');
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const describe = (e: ActivityEvent): string => {
  const d = e.detalhes || {};
  const tela = d.tela === 'abastecimento' ? 'Abastecimento' : d.tela === 'registro' ? 'Registro diário' : '';
  switch (e.evento) {
    case 'app_aberto':
      return d.voltouRecarregado
        ? `⚠ A página recarregou sozinha ${d.segundosFora}s depois de sair — o celular fechou o app (memória). O que não tinha sido enviado só volta pelo rascunho.`
        : d.recarregou ? 'Recarregou a página' : '';
    case 'voltou_ao_app': return d.segundosFora != null ? `ficou ${d.segundosFora}s fora` : '';
    case 'foto_anexada': return `${tela} · ${d.kb} KB (original ${d.origemKb} KB) · ${d.ms} ms`;
    case 'foto_escolhida': return `${tela} · original ${d.origemKb} KB`;
    case 'foto_erro': return `${tela} · ${d.etapa === 'upload' ? 'não conseguiu subir a foto' : 'não conseguiu processar a foto'} · ${d.mensagem || ''}`;
    case 'envio_tocado':
      return d.tela === 'abastecimento'
        ? `Abastecimento · ${vName(d.veiculo)}${d.comFoto ? ' · com foto' : ' · sem foto'}`
        : `Registro ${d.dia || ''} · ${vName(d.veiculo)} · ${d.servicos} serviço(s) na tela, ${d.novosServicos} novo(s), ${d.comFoto} com foto`;
    case 'envio_ok':
      return d.tela === 'abastecimento' ? `Abastecimento · ${(d.ms / 1000).toFixed(1)}s` : `Registro ${d.dia || ''} · ${d.servicos} serviço(s), ${d.despesas} despesa(s) · ${(d.ms / 1000).toFixed(1)}s`;
    case 'envio_erro': return `${tela} · ${(d.ms / 1000).toFixed(1)}s · ${d.mensagem || ''}`;
    case 'aviso': return `${tela}: "${d.mensagem}"`;
    case 'rascunho_recuperado': return `${d.servicos} serviço(s), ${d.despesas} despesa(s)${d.fotosPerdidas ? ' · fotos precisaram ser anexadas de novo' : ''}`;
    case 'servico_adicionado': case 'despesa_adicionada': return `${d.dia || ''} · ${vName(d.veiculo)}`;
    default: return '';
  }
};

const ActivityPanel: React.FC = () => {
  const [dia, setDia] = useState(() => new Date().toLocaleDateString('sv-SE'));
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [driver, setDriver] = useState('');

  const load = async () => {
    setLoading(true);
    try { setEvents(await fetchActivity(dia)); } catch (e) { console.error(e); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [dia]);
  useEffect(() => { purgeOldActivity(); }, []);

  const drivers = useMemo(() => {
    const m = new Map<string, { name: string; n: number; erros: number }>();
    events.forEach(e => {
      const c = m.get(e.userId) || { name: e.driverName, n: 0, erros: 0 };
      c.n++; if (['envio_erro', 'foto_erro', 'rascunho_recuperado'].includes(e.evento) || e.detalhes?.voltouRecarregado) c.erros++;
      m.set(e.userId, c);
    });
    return [...m.entries()].sort((a, b) => b[1].erros - a[1].erros || a[1].name.localeCompare(b[1].name));
  }, [events]);

  const shown = events.filter(e => !driver || e.userId === driver);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Activity className="w-5 h-5 text-indigo-600" /> Atividade dos motoristas</h1>
          <p className="text-sm text-gray-500 mt-0.5">O que cada motorista fez no app (sem gravar a tela nem o que foi digitado). Guardado por {ACTIVITY_DAYS} dias.</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={dia} onChange={e => setDia(e.target.value)} className="p-2 border border-gray-300 rounded-lg text-sm" />
          <button onClick={load} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Atualizar"><RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-2 space-y-1 max-h-[70vh] overflow-y-auto">
          <button onClick={() => setDriver('')} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${!driver ? 'bg-indigo-50 text-indigo-800 font-semibold' : 'hover:bg-gray-50'}`}>
            Todos ({events.length} eventos)
          </button>
          {drivers.map(([id, c]) => (
            <button key={id} onClick={() => setDriver(id)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${driver === id ? 'bg-indigo-50 text-indigo-800 font-semibold' : 'hover:bg-gray-50'}`}>
              <span className="block truncate">{c.name}</span>
              <span className="text-xs text-gray-500">{c.n} eventos{c.erros ? <span className="text-red-600 font-semibold"> · {c.erros} problema(s)</span> : ''}</span>
            </button>
          ))}
        </div>

        <div className="lg:col-span-9 bg-white rounded-xl border border-gray-200 p-3">
          {loading ? (
            <div className="p-10 text-center text-gray-500 flex flex-col items-center gap-3"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /> Carregando...</div>
          ) : shown.length === 0 ? (
            <div className="p-10 text-center text-gray-500">Nenhuma atividade registrada neste dia.</div>
          ) : (
            <ol className="space-y-1.5">
              {shown.map(e => {
                const [label, tone0] = LABELS[e.evento] || [e.evento, 'neutro' as Tone];
                const tone: Tone = e.evento === 'app_aberto' && e.detalhes?.voltouRecarregado ? 'alerta' : tone0;
                const desc = describe(e);
                return (
                  <li key={e.id} className={`flex gap-3 items-start border rounded-lg px-3 py-2 text-sm ${TONE[tone]}`}>
                    <span className="tabular-nums text-xs text-gray-500 mt-0.5 w-16 shrink-0">{hora(e.at)}</span>
                    <div className="flex-1 min-w-0">
                      {!driver && <span className="font-semibold mr-1">{e.driverName}:</span>}
                      <span className="font-medium">{label}</span>
                      {desc && <span className="block text-xs mt-0.5 opacity-90 break-words">{desc}</span>}
                    </div>
                    <span className="shrink-0 text-[11px] text-gray-500 flex items-center gap-1" title={`Conexão: ${e.conexao || '?'} · memória: ${e.memoriaGB ?? '?'} GB · versão ${e.versao}`}>
                      {e.online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5 text-red-600" />}
                      {e.online ? (e.conexao || '') : 'sem internet'}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
};

export default ActivityPanel;
