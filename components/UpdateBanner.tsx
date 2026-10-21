import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

// Detecta quando uma versão nova do app foi publicada enquanto a página já
// estava aberta. Compara o arquivo principal (/assets/index-<hash>.js) carregado
// nesta aba com o que o servidor está servindo agora. Se mudou, mostra um aviso
// para recarregar — evita alguém seguir usando uma versão antiga por dias.
const currentBundle = (): string | null => {
  const s = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]');
  return s ? new URL(s.src, location.href).pathname : null;
};

const CHECK_EVERY_MS = 5 * 60 * 1000;

const UpdateBanner: React.FC = () => {
  const [hasUpdate, setHasUpdate] = useState(false);

  useEffect(() => {
    const mine = currentBundle();
    if (!mine) return; // ambiente de desenvolvimento: não há bundle com hash

    let stopped = false;
    const check = async () => {
      if (stopped || document.visibilityState === 'hidden') return;
      try {
        const html = await fetch(`/?v=${Date.now()}`, { cache: 'no-store' }).then(r => r.text());
        const m = html.match(/\/assets\/index-[^"']+\.js/);
        if (m && m[0] !== mine) setHasUpdate(true);
      } catch {
        /* sem internet: tenta de novo depois */
      }
    };

    const timer = window.setInterval(check, CHECK_EVERY_MS);
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    check();
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  if (!hasUpdate) return null;
  return (
    <div className="fixed z-[70] bottom-4 right-4 left-4 sm:left-auto sm:max-w-sm bg-indigo-600 text-white rounded-xl shadow-2xl">
      <div className="px-4 py-3 flex flex-col gap-2 text-sm">
        <span className="font-medium">Há uma versão nova do GuinchoLog. Atualize para continuar usando com segurança.</span>
        <button
          onClick={() => location.reload()}
          className="self-start inline-flex items-center gap-1.5 bg-white text-indigo-700 font-bold rounded-lg px-3 py-1.5 hover:bg-indigo-50"
        >
          <RefreshCw className="w-4 h-4" /> Atualizar agora
        </button>
      </div>
    </div>
  );
};

export default UpdateBanner;
