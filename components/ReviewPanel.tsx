import React, { useEffect, useState } from 'react';
import { getAllLogs, fetchFuelRecords, deleteLog, saveFuelRecord } from '../services/storage';
import { VEHICLES } from '../constants';
import { DailyLog, FuelRecord } from '../types';
import { AlertTriangle, Loader2, ArrowRight, ShieldCheck, Wand2 } from 'lucide-react';

type Sev = 'grave' | 'atencao' | 'incompleto';

// Correções mecânicas — casos em que o sistema sabe exatamente o que fazer.
type AutoFix =
  | { kind: 'total'; recordId: string; newTotal: number }
  | { kind: 'dupe'; keepId: string; removeIds: string[] }
  | { kind: 'blank'; logId: string };

interface Finding {
  sev: Sev;
  type: string;
  who: string;
  desc: string;
  area: 'refuel' | 'log';
  recordId?: string; // id do abastecimento (refuel) ou do registro (log) para abrir na edição
  autofix?: AutoFix; // presente quando dá para corrigir automaticamente
}

const vehicleName = (id: string) => VEHICLES.find(v => v.id === id)?.name || id;
const isArla = (r: FuelRecord) => (r.fuelType || '').toUpperCase().includes('ARLA');
const todayStr = () => new Date().toISOString().split('T')[0];
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const round2 = (n: number) => Math.round(n * 100) / 100;

const SEV_ORDER: Record<Sev, number> = { grave: 0, atencao: 1, incompleto: 2 };
const CASH = (pm: string) => pm === 'DINHEIRO' || pm === 'CASH';

function computeFindings(logs: DailyLog[], fuels: FuelRecord[]): Finding[] {
  const out: Finding[] = [];
  const hoje = todayStr();

  // ---------- ABASTECIMENTOS ----------
  const byVeh: Record<string, FuelRecord[]> = {};
  fuels.forEach(r => { (byVeh[r.vehicleId] = byVeh[r.vehicleId] || []).push(r); });

  Object.entries(byVeh).forEach(([vid, recs]) => {
    const nome = vehicleName(vid);
    const sorted = [...recs].sort((a, b) => {
      const d = new Date(a.date).getTime() - new Date(b.date).getTime();
      return d !== 0 ? d : (Number(a.odometer) || 0) - (Number(b.odometer) || 0);
    });

    let prevOdo: number | null = null;
    // para "consumo suspeito" (só caminhões VTR)
    let estKm = 0, estLit = 0, fills = 0;

    sorted.forEach(r => {
      const who = `${nome} · ${r.date} · ${r.driverName || '—'}`;
      const litros = Number(r.liters);
      const preco = Number(r.pricePerLiter);
      const total = Number(r.total);
      const odo = Number(r.odometer);

      if (r.date > hoje) out.push({ sev: 'atencao', type: 'Data no futuro', who, area: 'refuel', recordId: r.id, desc: `Data ${r.date} é futura (hoje é ${hoje}).` });

      if (!isArla(r)) {
        // total não confere → correção automática: total = litros × preço
        if (litros > 0 && preco > 0 && Math.abs(total - litros * preco) > 1) {
          const newTotal = round2(litros * preco);
          out.push({ sev: 'grave', type: 'Total não confere', who, area: 'refuel', recordId: r.id,
            desc: `Registrado ${brl(total)}, mas ${litros.toFixed(2)} L × ${brl(preco)} = ${brl(newTotal)}. Posso corrigir o total.`,
            autofix: { kind: 'total', recordId: r.id, newTotal } });
        }
        // preço fora do normal
        if (preco > 0 && (preco < 3 || preco > 10)) {
          out.push({ sev: 'atencao', type: 'Preço por litro fora do normal', who, area: 'refuel', recordId: r.id,
            desc: `Preço ${brl(preco)}/L — verifique se a vírgula está certa.` });
        }
        // ARLA lançado como diesel
        if (!r.arlaValue && (r.observations || '').toUpperCase().includes('ARLA')) {
          out.push({ sev: 'atencao', type: 'ARLA lançado como diesel', who, area: 'refuel', recordId: r.id,
            desc: `A observação menciona "arla", mas o tipo é ${r.fuelType}. Separe o ARLA nos campos próprios.` });
        }
        // comprovante faltando
        if (!r.proofImage) {
          out.push({ sev: 'incompleto', type: 'Comprovante faltando', who, area: 'refuel', recordId: r.id, desc: `Abastecimento sem foto do comprovante.` });
        }
        // odômetro
        if (!Number.isFinite(odo) || odo <= 0) {
          out.push({ sev: 'incompleto', type: 'Odômetro faltando', who, area: 'refuel', recordId: r.id, desc: `Abastecimento sem odômetro — impede o cálculo de km/L.` });
        } else {
          if (prevOdo !== null && odo < prevOdo) {
            out.push({ sev: 'grave', type: 'Odômetro retrocedeu', who, area: 'refuel', recordId: r.id,
              desc: `Odômetro ${odo.toLocaleString('pt-BR')} é menor que o anterior do veículo (${prevOdo.toLocaleString('pt-BR')}).` });
          }
          // acumula estimativa (só VTR)
          if (vid.startsWith('vtr-') && prevOdo !== null && odo > prevOdo && litros > 0) {
            estKm += (odo - prevOdo); estLit += litros; fills++;
          }
          prevOdo = prevOdo === null ? odo : Math.max(prevOdo, odo);
        }
      }
    });

    // consumo suspeito (só caminhões, faixa diesel 1,5–8)
    if (vid.startsWith('vtr-') && fills >= 1 && estKm > 100 && estLit > 0) {
      const kmL = estKm / estLit;
      if (kmL < 1.5 || kmL > 8) {
        out.push({ sev: 'atencao', type: 'Consumo suspeito', who: nome, area: 'refuel',
          desc: `Consumo estimado ${kmL.toFixed(2)} km/L (fora da faixa 1,5–8 de caminhão). Verifique litros/odômetro.` });
      }
    }
  });

  // ---------- REGISTROS DIÁRIOS ----------
  // duplicados: mesmo motorista + mesma data + MESMO veículo.
  // (o mesmo motorista pode rodar veículos diferentes no dia — isso é legítimo.)
  const grp: Record<string, DailyLog[]> = {};
  logs.forEach(l => {
    const key = `${l.userId || l.driverName}||${l.date}||${l.vehicleId || ''}`;
    (grp[key] = grp[key] || []).push(l);
  });
  Object.values(grp).forEach(g => {
    if (g.length > 1) {
      // mantém o registro mais completo (mais serviços+despesas); empate → o mais recente.
      const ranked = [...g].sort((a, b) => {
        const ca = (Array.isArray(a.services) ? a.services.length : 0) + (Array.isArray(a.expenses) ? a.expenses.length : 0);
        const cb = (Array.isArray(b.services) ? b.services.length : 0) + (Array.isArray(b.expenses) ? b.expenses.length : 0);
        if (cb !== ca) return cb - ca;
        return new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime();
      });
      const keep = ranked[0];
      const removeIds = ranked.slice(1).map(x => x.id);
      out.push({ sev: 'grave', type: 'Registro duplicado', who: `${keep.driverName} · ${vehicleName(keep.vehicleId)} · ${keep.date}`, area: 'log', recordId: keep.id,
        desc: `${g.length} registros iguais (mesmo motorista, dia e veículo). Mantenho o mais completo e removo ${removeIds.length} repetido(s).`,
        autofix: { kind: 'dupe', keepId: keep.id, removeIds } });
    }
  });

  logs.forEach(l => {
    const who = `${l.driverName} · ${l.date}`;
    const services = Array.isArray(l.services) ? l.services : [];
    const expenses = Array.isArray(l.expenses) ? l.expenses : [];
    if (l.date > hoje) out.push({ sev: 'atencao', type: 'Data no futuro', who, area: 'log', recordId: l.id, desc: `Data ${l.date} é futura (hoje é ${hoje}).` });
    if (services.length === 0 && expenses.length === 0) {
      out.push({ sev: 'incompleto', type: 'Registro em branco', who, area: 'log', recordId: l.id,
        desc: `Registro sem nenhum serviço ou despesa. Posso remover.`,
        autofix: { kind: 'blank', logId: l.id } });
    }
    services.forEach(s => {
      const val = Number(s.value) || 0;
      if (!CASH(s.paymentMethod as any) && (s.paymentMethod as any) !== 'A PRAZO' && val <= 0) {
        // pago (não à prazo) sem valor
        out.push({ sev: 'incompleto', type: 'Serviço sem valor', who, area: 'log', recordId: l.id, desc: `Serviço com pagamento "${s.paymentMethod}" sem valor informado.` });
      }
      if (CASH(s.paymentMethod as any) && !s.proofImage) {
        out.push({ sev: 'incompleto', type: 'Comprovante faltando', who, area: 'log', recordId: l.id, desc: `Serviço em dinheiro (${s.clientName || s.destination || 'serviço'}) sem comprovante.` });
      }
    });
  });

  return out.sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev]);
}

const sevChip: Record<Sev, { label: string; cls: string; dot: string }> = {
  grave: { label: 'Grave', cls: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
  atencao: { label: 'Atenção', cls: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  incompleto: { label: 'Incompleto', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
};

const fixLabel = (fx: AutoFix): string => {
  if (fx.kind === 'total') return `Corrigir total para ${brl(fx.newTotal)}? O sistema vai gravar litros × preço.`;
  if (fx.kind === 'dupe') return `Manter 1 registro e remover ${fx.removeIds.length} repetido(s)? Essa ação apaga os repetidos.`;
  return 'Remover este registro em branco? Ele não tem serviço nem despesa.';
};

const ReviewPanel: React.FC<{ onGoTo: (area: 'refuel' | 'log', recordId?: string) => void }> = ({ onGoTo }) => {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [fuels, setFuels] = useState<FuelRecord[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [fixingIdx, setFixingIdx] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [l, f] = await Promise.all([getAllLogs(), fetchFuelRecords()]);
      setLogs(l);
      setFuels(f);
      setFindings(computeFindings(l, f));
    } catch (e) {
      console.error('Erro ao revisar', e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const applyFix = async (f: Finding, idx: number) => {
    const fx = f.autofix;
    if (!fx) return;
    if (!window.confirm(fixLabel(fx))) return;
    setFixingIdx(idx);
    try {
      if (fx.kind === 'dupe') {
        for (const id of fx.removeIds) await deleteLog(id);
      } else if (fx.kind === 'blank') {
        await deleteLog(fx.logId);
      } else if (fx.kind === 'total') {
        const rec = fuels.find(r => r.id === fx.recordId);
        if (rec) await saveFuelRecord({ ...rec, total: fx.newTotal });
      }
      await load();
    } catch (e) {
      console.error('Falha ao corrigir', e);
      alert('Não consegui aplicar a correção. Verifique a conexão e tente de novo.');
    } finally {
      setFixingIdx(null);
    }
  };

  const counts = {
    grave: findings.filter(f => f.sev === 'grave').length,
    atencao: findings.filter(f => f.sev === 'atencao').length,
    incompleto: findings.filter(f => f.sev === 'incompleto').length,
  };

  const autoFixable = findings.filter(f => f.autofix);
  const dupeFindings = autoFixable.filter(f => f.autofix!.kind === 'dupe');

  const fixAll = async (list: Finding[], label: string) => {
    if (list.length === 0) return;
    if (!window.confirm(`${label}\n\nSão ${list.length} caso(s). Continuar?`)) return;
    setFixingIdx(-1); // trava a UI durante o lote
    try {
      for (const f of list) {
        const fx = f.autofix!;
        if (fx.kind === 'dupe') {
          for (const id of fx.removeIds) await deleteLog(id);
        } else if (fx.kind === 'blank') {
          await deleteLog(fx.logId);
        } else if (fx.kind === 'total') {
          const rec = fuels.find(r => r.id === fx.recordId);
          if (rec) await saveFuelRecord({ ...rec, total: fx.newTotal });
        }
      }
      await load();
    } catch (e) {
      console.error('Falha ao corrigir em lote', e);
      alert('Algumas correções podem não ter sido aplicadas. Recarregue e verifique.');
      await load();
    } finally {
      setFixingIdx(null);
    }
  };

  const batchRunning = fixingIdx === -1;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-indigo-600" />
          Painel de Revisão
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Lançamentos que provavelmente têm erro — o sistema aponta e, quando dá, corrige pra você.</p>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-500 flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" /> Revisando os lançamentos...
        </div>
      ) : findings.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-500 flex flex-col items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-green-500" /> Nenhum problema encontrado. Tudo certo! 🎉
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-red-500 p-4 shadow-sm">
              <div className="text-2xl font-extrabold">{counts.grave}</div><div className="text-xs text-gray-500 mt-1">Graves (corrigir logo)</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-amber-500 p-4 shadow-sm">
              <div className="text-2xl font-extrabold">{counts.atencao}</div><div className="text-xs text-gray-500 mt-1">Atenção</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-yellow-400 p-4 shadow-sm">
              <div className="text-2xl font-extrabold">{counts.incompleto}</div><div className="text-xs text-gray-500 mt-1">Incompletos</div>
            </div>
          </div>

          {/* Ações em lote */}
          {dupeFindings.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div className="text-sm text-green-900">
                <strong>{dupeFindings.length}</strong> grupo(s) de registros duplicados detectados.
                Posso remover os repetidos automaticamente (mantendo o mais completo de cada dia/veículo).
              </div>
              <button
                onClick={() => fixAll(dupeFindings, 'Remover todos os registros duplicados de uma vez, mantendo 1 de cada grupo.')}
                disabled={batchRunning}
                className="flex-none flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
              >
                {batchRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                Remover duplicados
              </button>
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            {findings.map((f, i) => {
              const c = sevChip[f.sev];
              const busy = fixingIdx === i || batchRunning;
              return (
                <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-3.5 flex gap-3 items-start">
                  <span className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-none ${c.dot}`}></span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-gray-900">{f.type}</span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${c.cls}`}>{c.label}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{f.who}</div>
                    <div className="text-[13px] text-gray-600 mt-1.5">{f.desc}</div>
                  </div>
                  {f.autofix ? (
                    <button
                      onClick={() => applyFix(f, i)}
                      disabled={busy}
                      className="flex-none self-center flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-[13px] font-semibold px-3 py-2 rounded-lg disabled:opacity-60"
                    >
                      {fixingIdx === i ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                      Corrigir automático
                    </button>
                  ) : (
                    <button
                      onClick={() => onGoTo(f.area, f.recordId)}
                      disabled={busy}
                      className="flex-none self-center flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-semibold px-3 py-2 rounded-lg disabled:opacity-60"
                    >
                      Abrir registro <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default ReviewPanel;
