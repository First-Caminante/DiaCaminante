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

  const filteredList = useMemo(() => {
    return REFLEXIONES_365.filter((r) => {
      if (autorSeleccionado !== 'Todos') {
        if (autorSeleccionado === 'Estoicismo') {
          if (r.categoria !== 'Estoicismo') return false;
        } else if (!r.autor.toLowerCase().includes(autorSeleccionado.toLowerCase())) {
          return false;
        }
      }

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
        return 'bg-[#215e28] text-[#d9f2c4] border-[#74a47b]';
      case 'Dureza Mental':
        return 'bg-[#1a281b] text-[#e28080] border-[#e28080]/60';
      case 'Sabiduría Espiritual':
        return 'bg-[#215e28] text-[#d9f2c4] border-[#74a47b]';
      case 'Riqueza y Estrategia':
        return 'bg-[#1a281b] text-[#fde68a] border-[#fde68a]/60';
      default:
        return 'bg-[#121c13] text-[#74a47b] border-[#74a47b]';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Featured Reflection */}
      <div className="card-tactical p-6 sm:p-8 border-2 border-[#74a47b]/50 shadow-[0_15px_35px_rgba(0,0,0,0.85)] relative overflow-hidden space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#74a47b]/20">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="tag-tactical inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs bg-[#000000] text-[#f8fafc] border-[#74a47b]">
              <span className="w-2 h-2 rounded-full bg-[#d9f2c4] animate-pulse"></span>
              <span>REFLEXIÓN DESTACADA • DÍA {featured.dia} / 365</span>
            </span>
            <span className={`tag-tactical text-[10px] px-2.5 py-1 rounded-lg ${getCategoryTagClass(featured.categoria)}`}>
              {featured.categoria}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopyQuote(featured)}
              className="btn-tactical-ghost px-3 py-1.5 rounded-xl text-xs font-mono font-bold uppercase flex items-center gap-1.5"
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
              className="btn-tactical px-4 py-1.5 rounded-xl text-xs font-mono font-bold uppercase flex items-center gap-1.5"
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
          <h2 className="text-xl sm:text-3xl font-display font-extrabold text-[#f8fafc] tracking-tight uppercase">
            {featured.tema}
          </h2>

          <blockquote className="p-5 sm:p-6 rounded-2xl bg-[#000000] border-l-4 border-[#d9f2c4] border-2 border-[#74a47b]/30 shadow-inner space-y-3">
            <p className="text-lg sm:text-2xl font-serif italic text-[#f8fafc] leading-relaxed">
              &ldquo;{featured.frase}&rdquo;
            </p>
            <footer className="text-xs sm:text-sm font-mono text-[#d9f2c4] flex items-center gap-2 font-bold uppercase">
              <span>— {featured.autor}</span>
              <span className="text-[#92aa95]">•</span>
              <cite className="not-italic text-[#92aa95] font-normal">{featured.origen}</cite>
            </footer>
          </blockquote>

          <div className="p-4 rounded-xl bg-[#1a281b] border border-[#74a47b]/40 space-y-1.5">
            <span className="text-xs font-mono uppercase tracking-wider text-[#d9f2c4] font-bold flex items-center gap-1.5">
              <span>⚡</span>
              <span>Aplicación para el Trabajo Profundo</span>
            </span>
            <p className="text-xs sm:text-sm text-[#92aa95] leading-relaxed font-mono">
              {featured.reflexion}
            </p>
          </div>
        </div>
      </div>

      {/* Explorer Section Header & Search */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-lg sm:text-xl font-display font-bold text-[#f8fafc] uppercase tracking-tight">
              Biblioteca de Disciplina y Fortaleza Mental
            </h3>
            <p className="text-xs font-mono text-[#92aa95]">
              Colección completa de 365 días: Estoicismo, David Goggins, Jesús de Nazaret, Buda, Brian Tracy, Napoleon Hill y John D. Rockefeller
            </p>
          </div>

          <span className="tag-tactical text-xs bg-[#215e28] text-[#d9f2c4] px-3 py-1.5 rounded-lg self-start sm:self-auto border-[#74a47b]">
            {filteredList.length} REFLEXIONES
          </span>
        </div>

        {/* Search input */}
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#92aa95]">
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
            className="w-full pl-10 pr-4 py-3 rounded-xl text-xs font-mono font-medium bg-[#000000] border-2 border-[#74a47b]/40 text-[#f8fafc] placeholder-[#92aa95]/40 focus:border-[#d9f2c4] focus:outline-none"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {AUTORES_FILTRO.map((autor) => {
            const isActive = autorSeleccionado === autor;
            return (
              <button
                key={autor}
                onClick={() => {
                  setAutorSeleccionado(autor);
                  setVisibleCount(12);
                }}
                className={`btn-tactical-ghost px-3 py-1.5 rounded-xl text-xs font-mono uppercase transition-all ${
                  isActive
                    ? 'bg-[#d9f2c4] text-[#000000] font-bold border-[#d9f2c4]'
                    : 'text-[#92aa95]'
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
        <div className="card-tactical p-10 text-center space-y-2 border-2 border-dashed border-[#74a47b]/30">
          <p className="text-sm font-display font-bold text-[#f8fafc] uppercase">No se encontraron reflexiones</p>
          <p className="text-xs font-mono text-[#92aa95]">Intenta buscar con otro término o elimina los filtros.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedList.map((item) => (
            <div
              key={item.dia}
              className="card-tactical p-5 border-2 border-[#74a47b]/30 hover:border-[#74a47b]/70 flex flex-col justify-between space-y-3 group"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="tag-tactical text-[10px] bg-[#000000] text-[#92aa95] px-2 py-0.5 rounded border-[#74a47b]/30">
                    DÍA {item.dia}
                  </span>
                  <span className={`tag-tactical text-[9px] px-2 py-0.5 rounded ${getCategoryTagClass(item.categoria)}`}>
                    {item.categoria}
                  </span>
                </div>

                <h4 className="text-xs font-display font-bold text-[#f8fafc] uppercase tracking-wider">
                  {item.tema}
                </h4>

                <p className="text-sm font-serif italic text-[#f8fafc] leading-relaxed">
                  &ldquo;{item.frase}&rdquo;
                </p>

                <p className="text-xs text-[#92aa95] leading-normal pt-1 border-t border-[#74a47b]/20 font-mono">
                  <span className="text-[#d9f2c4] font-bold">↳</span> {item.reflexion}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#74a47b]/20 text-[11px] font-mono">
                <div className="text-[#d9f2c4] truncate pr-2 font-bold uppercase">
                  <span>{item.autor}</span>
                  <span className="text-[#92aa95] ml-1 font-normal">({item.origen})</span>
                </div>

                <button
                  onClick={() => handleCopyQuote(item)}
                  className="btn-tactical-ghost p-1.5 rounded-lg text-[#92aa95] hover:text-[#d9f2c4]"
                  title="Copiar cita"
                >
                  {copiedId === item.dia ? (
                    <span className="text-[10px] text-[#d9f2c4] font-bold">✓</span>
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
            className="btn-tactical px-6 py-3 rounded-xl text-xs font-mono font-bold uppercase"
          >
            Cargar más reflexiones ({filteredList.length - visibleCount} restantes)
          </button>
        </div>
      )}
    </div>
  );
};
