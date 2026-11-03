import React, { useState, useMemo } from 'react';
import {
  REFLEXIONES_365,
  getReflexionDeHoy,
  getReflexionAleatoria,
  type ReflexionDiaria,
} from '../data/reflections';

const AUTORES_FILTRO = [
  'Todos',
  'Estoicismo',
  'David Goggins',
  'Jesús de Nazaret',
  'Buda Gautama',
  'Brian Tracy',
  'Napoleon Hill',
  'John D. Rockefeller',
];

export const PhilosophyView: React.FC = () => {
  const [featured, setFeatured] = useState<ReflexionDiaria>(getReflexionDeHoy());
  const [autorSeleccionado, setAutorSeleccionado] = useState<string>('Todos');
  const [busqueda, setBusqueda] = useState<string>('');
  const [visibleCount, setVisibleCount] = useState<number>(12);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const handleNextRandom = () => {
    setFeatured(getReflexionAleatoria());
  };

  const handleCopyQuote = async (item: ReflexionDiaria) => {
    try {
      const text = `"${item.frase}" — ${item.autor} (${item.origen})\n\nReflexión: ${item.reflexion}`;
      await navigator.clipboard.writeText(text);
      setCopiedId(item.dia);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      // Fallback
    }
  };

  // Filtered reflections list
  const filteredList = useMemo(() => {
    return REFLEXIONES_365.filter((r) => {
      // Author filter
      if (autorSeleccionado !== 'Todos') {
        if (autorSeleccionado === 'Estoicismo') {
          if (r.categoria !== 'Estoicismo') return false;
        } else if (!r.autor.toLowerCase().includes(autorSeleccionado.toLowerCase())) {
          return false;
        }
      }

      // Keyword search
      if (busqueda.trim()) {
        const query = busqueda.toLowerCase().trim();
        const inFrase = r.frase.toLowerCase().includes(query);
        const inReflexion = r.reflexion.toLowerCase().includes(query);
        const inAutor = r.autor.toLowerCase().includes(query);
        const inTema = r.tema.toLowerCase().includes(query);
        return inFrase || inReflexion || inAutor || inTema;
      }

      return true;
    });
  }, [autorSeleccionado, busqueda]);

  const displayedList = useMemo(() => {
    return filteredList.slice(0, visibleCount);
  }, [filteredList, visibleCount]);

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Estoicismo':
        return 'text-pastel-lavender bg-pastel-lavender/10 border-pastel-lavender/30';
      case 'Dureza Mental':
        return 'text-pastel-coral bg-pastel-coral/10 border-pastel-coral/30';
      case 'Sabiduría Espiritual':
        return 'text-pastel-mint bg-pastel-mint/10 border-pastel-mint/30';
      case 'Riqueza y Estrategia':
        return 'text-pastel-amber bg-pastel-amber/10 border-pastel-amber/30';
      default:
        return 'text-pastel-ice bg-pastel-ice/10 border-pastel-ice/30';
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 my-4 space-y-8 animate-fade-in">
      
      {/* Hero Featured Reflection */}
      <div className="card-midnight rounded-3xl p-6 sm:p-8 shadow-2xl border border-pastel-lavender/30 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-pastel-lavender/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="space-y-6 relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono uppercase tracking-widest bg-midnight-950 text-pastel-lavender border border-pastel-lavender/30">
                <span className="w-1.5 h-1.5 rounded-full bg-pastel-lavender animate-pulse"></span>
                Reflexión Destacada • Día {featured.dia} de 365
              </span>
              <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border ${getCategoryColor(featured.categoria)}`}>
                {featured.categoria}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopyQuote(featured)}
                className="px-3 py-1.5 rounded-xl text-xs font-mono bg-midnight-800 hover:bg-midnight-700 text-slate-300 hover:text-white border border-white/5 transition-all active:scale-95 flex items-center gap-1.5"
                title="Copiar cita y reflexión"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span>{copiedId === featured.dia ? '¡Copiado!' : 'Copiar'}</span>
              </button>

              <button
                onClick={handleNextRandom}
                className="px-3.5 py-1.5 rounded-xl text-xs font-mono bg-pastel-lavender text-midnight-950 font-bold hover:bg-pastel-lavenderDark shadow-glow-lavender transition-all active:scale-95 flex items-center gap-1.5"
                title="Obtener otra reflexión aleatoria"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                <span>Siguiente Perla</span>
              </button>
            </div>
          </div>

          {/* Featured Quote */}
          <div className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {featured.tema}
            </h2>

            <blockquote className="p-5 sm:p-6 rounded-2xl bg-midnight-950/80 border-l-4 border-pastel-lavender border border-white/5 space-y-3">
              <p className="text-lg sm:text-xl font-serif italic text-slate-100 leading-relaxed">
                &ldquo;{featured.frase}&rdquo;
              </p>
              <footer className="text-xs sm:text-sm font-mono text-pastel-lavender flex items-center gap-2">
                <span className="font-semibold">— {featured.autor}</span>
                <span className="text-slate-500">•</span>
                <cite className="not-italic text-slate-400">{featured.origen}</cite>
              </footer>
            </blockquote>

            <div className="p-4 sm:p-5 rounded-2xl bg-midnight-950/40 border border-white/5 space-y-1.5">
              <span className="text-xs font-mono uppercase tracking-wider text-pastel-mint font-semibold flex items-center gap-1.5">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                Aplicación para el Trabajo Profundo
              </span>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {featured.reflexion}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Explorer Section Header & Search */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white tracking-tight">
              Biblioteca de Disciplina y Fortaleza Mental
            </h3>
            <p className="text-xs text-slate-400">
              Colección completa de 365 días: Estoicismo, David Goggins, Jesús de Nazaret, Buda, Brian Tracy, Napoleon Hill y John D. Rockefeller
            </p>
          </div>

          <span className="text-xs font-mono text-pastel-lavender bg-midnight-800 px-3 py-1 rounded-full border border-white/5 self-start sm:self-auto">
            {filteredList.length} reflexiones encontradas
          </span>
        </div>

        {/* Search input */}
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Buscar por palabra clave: disciplina, foco, dolor, mente, atención, roca..."
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setVisibleCount(12);
            }}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs bg-midnight-950 border border-white/10 text-white placeholder-slate-500 focus:border-pastel-lavender/50 focus:outline-none"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {AUTORES_FILTRO.map((autor) => {
            const isActive = autorSeleccionado === autor;
            return (
              <button
                key={autor}
                onClick={() => {
                  setAutorSeleccionado(autor);
                  setVisibleCount(12);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-pastel-lavender text-midnight-950 font-bold shadow-glow-lavender'
                    : 'bg-midnight-800 text-slate-300 hover:text-white border border-white/5 hover:border-white/10'
                }`}
              >
                {autor}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Reflections */}
      {displayedList.length === 0 ? (
        <div className="card-midnight rounded-2xl p-10 text-center space-y-2 border border-white/5">
          <p className="text-sm text-slate-300 font-medium">No se encontraron reflexiones</p>
          <p className="text-xs text-slate-500">Intenta buscar con otro término o elimina los filtros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedList.map((item) => (
            <div
              key={item.dia}
              className="card-midnight rounded-2xl p-5 border border-white/5 hover:border-white/15 transition-all duration-200 flex flex-col justify-between space-y-3 group"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-slate-400 bg-midnight-950 px-2 py-0.5 rounded border border-white/5">
                    Día {item.dia}
                  </span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${getCategoryColor(item.categoria)}`}>
                    {item.categoria}
                  </span>
                </div>

                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                  {item.tema}
                </h4>

                <p className="text-sm font-serif italic text-white leading-relaxed">
                  &ldquo;{item.frase}&rdquo;
                </p>

                <p className="text-xs text-slate-400 leading-normal pt-1 border-t border-white/5">
                  <span className="text-pastel-mint font-mono font-semibold">↳</span> {item.reflexion}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] font-mono">
                <div className="text-pastel-lavender truncate pr-2">
                  <span className="font-semibold">{item.autor}</span>
                  <span className="text-slate-500 ml-1">({item.origen})</span>
                </div>

                <button
                  onClick={() => handleCopyQuote(item)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  title="Copiar cita"
                >
                  {copiedId === item.dia ? (
                    <span className="text-[10px] text-pastel-mint font-bold">✓</span>
                  ) : (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load More Button */}
      {visibleCount < filteredList.length && (
        <div className="text-center pt-4">
          <button
            onClick={() => setVisibleCount((prev) => prev + 12)}
            className="px-6 py-2.5 rounded-xl text-xs font-mono font-semibold text-slate-200 bg-midnight-800 hover:bg-midnight-700 border border-white/10 transition-all active:scale-95 shadow-md"
          >
            Cargar más reflexiones ({filteredList.length - visibleCount} restantes)
          </button>
        </div>
      )}
    </div>
  );
};
