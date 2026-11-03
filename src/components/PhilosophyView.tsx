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

  const getCategoryTagClass = (cat: string) => {
    switch (cat) {
      case 'Estoicismo':
        return 'bg-retro-lavender text-midnight-950';
      case 'Dureza Mental':
        return 'bg-retro-coral text-midnight-950';
      case 'Sabiduría Espiritual':
        return 'bg-retro-mint text-midnight-950';
      case 'Riqueza y Estrategia':
        return 'bg-retro-amber text-midnight-950';
      default:
        return 'bg-retro-ice text-midnight-950';
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 my-4 space-y-8 animate-fade-in">
      
      {/* Hero Featured Reflection */}
      <div className="card-acrylic p-6 sm:p-8 shadow-brutal border-2 border-retro-lavender relative overflow-hidden space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-white/10">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="tag-retro inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs bg-midnight-950 text-slate-200 border-white/20">
              <span className="w-2 h-2 rounded-full bg-retro-lavender animate-pulse"></span>
              <span>REFLEXIÓN DESTACADA • DÍA {featured.dia} / 365</span>
            </span>
            <span className={`tag-retro text-[10px] px-2.5 py-1 rounded-lg ${getCategoryTagClass(featured.categoria)}`}>
              {featured.categoria}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopyQuote(featured)}
              className="btn-neo px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-midnight-950 hover:bg-midnight-800 text-slate-200 border-white/20 uppercase flex items-center gap-1.5"
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
              className="btn-neo px-4 py-1.5 rounded-xl text-xs font-mono bg-retro-lavender text-midnight-950 font-bold uppercase flex items-center gap-1.5"
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
          <h2 className="text-xl sm:text-3xl font-display font-extrabold text-white tracking-tight uppercase">
            {featured.tema}
          </h2>

          <blockquote className="p-5 sm:p-6 rounded-2xl bg-midnight-950 border-l-4 border-retro-lavender border-2 border-white/10 shadow-brutal-sm space-y-3">
            <p className="text-lg sm:text-2xl font-serif italic text-slate-100 leading-relaxed">
              &ldquo;{featured.frase}&rdquo;
            </p>
            <footer className="text-xs sm:text-sm font-mono text-retro-lavender flex items-center gap-2 font-bold uppercase">
              <span>— {featured.autor}</span>
              <span className="text-slate-500">•</span>
              <cite className="not-italic text-slate-400 font-normal">{featured.origen}</cite>
            </footer>
          </blockquote>

          <div className="p-4.5 rounded-2xl bg-midnight-900 border-2 border-white/10 shadow-brutal-sm space-y-1.5">
            <span className="text-xs font-mono uppercase tracking-wider text-retro-mint font-bold flex items-center gap-1.5">
              <span>⚡</span>
              <span>Aplicación para el Trabajo Profundo</span>
            </span>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-mono">
              {featured.reflexion}
            </p>
          </div>
        </div>
      </div>

      {/* Explorer Section Header & Search */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-lg sm:text-xl font-display font-bold text-white uppercase tracking-tight">
              Biblioteca de Disciplina y Fortaleza Mental
            </h3>
            <p className="text-xs font-mono text-slate-400">
              Colección completa de 365 días: Estoicismo, David Goggins, Jesús de Nazaret, Buda, Brian Tracy, Napoleon Hill y John D. Rockefeller
            </p>
          </div>

          <span className="tag-retro text-xs bg-retro-lavender text-midnight-950 px-3 py-1.5 rounded-lg self-start sm:self-auto shadow-brutal-sm">
            {filteredList.length} REFLEXIONES
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
            className="w-full pl-10 pr-4 py-3 rounded-xl text-xs font-mono font-medium bg-midnight-950 border-2 border-white/15 text-white placeholder-slate-500 shadow-brutal-sm focus:border-retro-lavender focus:outline-none"
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
                className={`btn-neo px-3 py-1.5 rounded-xl text-xs font-mono uppercase transition-all ${
                  isActive
                    ? 'bg-retro-lavender text-midnight-950 font-bold'
                    : 'bg-midnight-950 text-slate-300 hover:text-white border-white/20'
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
        <div className="card-acrylic p-10 text-center space-y-2 border-2 border-dashed border-white/15 shadow-brutal">
          <p className="text-sm font-display font-bold text-slate-300 uppercase">No se encontraron reflexiones</p>
          <p className="text-xs font-mono text-slate-500">Intenta buscar con otro término o elimina los filtros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedList.map((item) => (
            <div
              key={item.dia}
              className="card-acrylic p-5 border-2 border-white/10 hover:border-white/25 shadow-brutal flex flex-col justify-between space-y-3 group"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="tag-retro text-[10px] bg-midnight-950 text-slate-300 px-2 py-0.5 rounded border-white/10">
                    DÍA {item.dia}
                  </span>
                  <span className={`tag-retro text-[9px] px-2 py-0.5 rounded ${getCategoryTagClass(item.categoria)}`}>
                    {item.categoria}
                  </span>
                </div>

                <h4 className="text-xs font-display font-bold text-white uppercase tracking-wider">
                  {item.tema}
                </h4>

                <p className="text-sm font-serif italic text-white leading-relaxed">
                  &ldquo;{item.frase}&rdquo;
                </p>

                <p className="text-xs text-slate-300 leading-normal pt-1 border-t-2 border-white/10 font-mono">
                  <span className="text-retro-mint font-bold">↳</span> {item.reflexion}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t-2 border-white/10 text-[11px] font-mono">
                <div className="text-retro-lavender truncate pr-2 font-bold uppercase">
                  <span>{item.autor}</span>
                  <span className="text-slate-500 ml-1 font-normal">({item.origen})</span>
                </div>

                <button
                  onClick={() => handleCopyQuote(item)}
                  className="btn-neo p-1.5 rounded-lg text-slate-300 bg-midnight-950 border-white/20 hover:text-white"
                  title="Copiar cita"
                >
                  {copiedId === item.dia ? (
                    <span className="text-[10px] text-retro-mint font-bold">✓</span>
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
            className="btn-neo px-6 py-3 rounded-xl text-xs font-mono font-bold uppercase text-midnight-950 bg-retro-mint"
          >
            Cargar más reflexiones ({filteredList.length - visibleCount} restantes)
          </button>
        </div>
      )}
    </div>
  );
};
