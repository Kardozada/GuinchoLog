import React, { useEffect, useState } from 'react';
import { getAllLogs, fetchFuelRecords } from '../services/storage';
import { VEHICLES } from '../constants';
import { DailyLog, FuelRecord } from '../types';
import { AlertTriangle, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';

type Sev = 'grave' | 'atencao' | 'incompleto';
interface Finding {
  sev: Sev;
  type: string;
  who: string;
  desc: string;
  area: 'refuel' | 'log';
}

const vehicleName = (id: string) => VEHICLES.find(v => v.id === id)?.name || id;
const isArla = (r: FuelRecord) => (r.fuelType || '').toUpperCase().includes('ARLA');
const todayStr = () => new Date().toISOString().split('T')[0];
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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

      if (r.date > hoje) out.push({ sev: 'atencao', type: 'Data no futuro', who, area: 'refuel', desc: `Data ${r.date} é futura (hoje é ${hoje}).` });

      if (!isArla(r)) {
        // total não confere
        if (litros > 0 && preco > 0 && Math.abs(total - litros * preco) > 1) {
          out.push({ sev: 'grave', type: 'Total não confere', who, area: 'refuel',
            desc: `Registrado ${brl(total)}, mas ${litros.toFixed(2)} L × ${brl(preco)} = ${brl(litros * preco)}.` });
        }
        // preço fora do normal
        if (preco > 0 && (preco < 3 || preco > 10)) {
          out.push({ sev: 'atencao', type: 'Preço por litro fora do normal', who, area: 'refuel',
            desc: `Preço ${brl(preco)}/L — verifique se a vírgula está certa.` });
        }
        // ARLA lançado como diesel
        if (!r.arlaValue && (r.observations || '').toUpperCase().includes('ARLA')) {
          out.push({ sev: 'atencao', type: 'ARLA lançado como diesel', who, area: 'refuel',
            desc: `A observação menciona "arla", mas o tipo é ${r.fuelType}. Separe o ARLA nos campos próprios.` });
        }
        // comprovante faltando
        if (!r.proofImage) {
          out.push({ sev: 'incompleto', type: 'Comprovante faltando', who, area: 'refuel', desc: `Abastecimento sem foto do comprovante.` });
        }
        // odômetro
        if (!Number.isFinite(odo) || odo <= 0) {
          out.push({ sev: 'incompleto', type: 'Odômetro faltando', who, area: 'refuel', desc: `Abastecimento sem odômetro — impede o cálculo de km/L.` });
        } else {
          if (prevOdo !== null && odo < prevOdo) {
            out.push({ sev: 'grave', type: 'Odômetro retrocedeu', who, area: 'refuel',
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
      const l = g[0];
      out.push({ sev: 'grave', type: 'Registro duplicado', who: `${l.driverName} · ${vehicleName(l.vehicleId)} · ${l.date}`, area: 'log',
        desc: `${g.length} registros no mesmo dia, mesmo motorista e mesmo veículo. Mantenha 1 e remova os repetidos.` });
    }
  });

  logs.forEach(l => {
    const who = `${l.driverName} · ${l.date}`;
    const services = Array.isArray(l.services) ? l.services : [];
    const expenses = Array.isArray(l.expenses) ? l.expenses : [];
    if (l.date > hoje) out.push({ sev: 'atencao', type: 'Data no futuro', who, area: 'log', desc: `Data ${l.date} é futura (hoje é ${hoje}).` });
    if (services.length === 0 && expenses.length === 0) {
      out.push({ sev: 'incompleto', type: 'Registro em branco', who, area: 'log', desc: `Registro sem nenhum serviço ou despesa.` });
    }
    services.forEach(s => {
      const val = Number(s.value) || 0;
      if (!CASH(s.paymentMethod as any) && (s.paymentMethod as any) !== 'A PRAZO' && val <= 0) {
        // pago (não à prazo) sem valor
        out.push({ sev: 'incompleto', type: 'Serviço sem valor', who, area: 'log', desc: `Serviço com pagamento "${s.paymentMethod}" sem valor informado.` });
      }
      if (CASH(s.paymentMethod as any) && !s.proofImage) {
        out.push({ sev: 'incompleto', type: 'Comprovante faltando', who, area: 'log', desc: `Serviço em dinheiro (${s.clientName || s.destination || 'serviço'}) sem comprovante.` });
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

const ReviewPanel: React.FC<{ onGoTo: (area: 'refuel' | 'log') => void }> = ({ onGoTo }) => {
  const [loading, setLoading] = useState(true);
  const [findings, setFindings] = useState<Finding[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const [logs, fuels] = await Promise.all([getAllLogs(), fetchFuelRecords()]);
      setFindings(computeFindings(logs, fuels));
    } catch (e) {
      console.error('Erro ao revisar', e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const counts = {
    grave: findings.filter(f => f.sev === 'grave').length,
    atencao: findings.filter(f => f.sev === 'atencao').length,
    incompleto: findings.filter(f => f.sev === 'incompleto').length,
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-indigo-600" />
          Painel de Revisão
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Lançamentos que provavelmente têm erro — o sistema aponta, você corrige.</p>
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

          <div className="flex flex-col gap-2.5">
            {findings.map((f, i) => {
              const c = sevChip[f.sev];
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
                  <button
                    onClick={() => onGoTo(f.area)}
                    className="flex-none self-center flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-semibold px-3 py-2 rounded-lg"
                  >
                    Corrigir <ArrowRight className="w-3.5 h-3.5" />
                  </button>
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
