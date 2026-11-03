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

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'Estoicismo':
        return 'bg-[#1e3a8a]/40 text-[#93c5fd] border-[#60a5fa]/30';
      case 'Dureza Mental':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'Sabiduría Espiritual':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'Riqueza y Estrategia':
        return 'bg-[#eed59b]/20 text-[#eed59b] border-[#eed59b]/40';
      default:
        return 'bg-[#0d1733] text-[#94a3b8] border-[#5b9bd5]/20';
    }
  };

  return (
    <div className="space-y-10 animate-fade-in">
      {/* =========================================================================
          HERO MONUMENTAL EDITORIAL (INSPIRADO FIELMENTE EN "BIBLIOTECA ENCANTADA")
          ========================================================================= */}
      <div className="text-center py-6 sm:py-10 space-y-4 max-w-3xl mx-auto">
        <span className="text-xs sm:text-sm font-sans font-semibold tracking-[0.25em] text-[#eed59b] uppercase block">
          Tu Próxima Reflexión te Espera
        </span>

        <h1 className="text-4xl sm:text-6xl font-serif font-bold text-white tracking-wide leading-tight">
          Biblioteca de <span className="text-[#eed59b]">Pensa</span><span className="text-[#60a5fa]">mien</span><span className="text-[#4ecdc4]">to</span>
        </h1>

        <p className="text-sm sm:text-base text-[#94a3b8] font-serif italic max-w-xl mx-auto leading-relaxed">
          Descubre mundos de serenidad y disciplina entre páginas. Máximas de vida y trabajo profundo seleccionadas con rigor para iluminar tu jornada.
        </p>

        <div className="pt-2 flex items-center justify-center gap-3">
          <button
            onClick={handleNextRandom}
            className="btn-formal inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-semibold shadow-midnight"
          >
            <span>✦</span>
            <span>Descubrir Reflexión</span>
          </button>
          <a
            href="#catalogo"
            className="btn-formal-outline inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-medium"
          >
            <span>📖</span>
            <span>Ver Catálogo 365</span>
          </a>
        </div>
      </div>

      {/* Tarjeta de la Reflexión Destacada */}
      <div className="card-midnight p-6 sm:p-8 border border-[#5b9bd5]/25 shadow-midnight-glow relative overflow-hidden space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#5b9bd5]/15">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="tag-formal inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-[#081229] text-white border border-[#5b9bd5]/30">
              <span className="w-2 h-2 rounded-full bg-[#eed59b] animate-pulse"></span>
              <span>Reflexión Destacada • Día {featured.dia} de 365</span>
            </span>
            <span className={`tag-formal text-[10px] px-3 py-1 rounded-full border ${getCategoryBadge(featured.categoria)}`}>
              {featured.categoria}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopyQuote(featured)}
              className="btn-formal-outline px-3.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5"
              title="Copiar cita y reflexión"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>{copiedId === featured.dia ? '¡Copiado!' : 'Copiar Cita'}</span>
            </button>

            <button
              onClick={handleNextRandom}
              className="btn-formal px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5"
              title="Obtener otra reflexión aleatoria"
            >
              <span>🎲</span>
              <span>Otra Frase</span>
            </button>
          </div>
        </div>

        {/* Cita Destacada */}
        <div className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-white tracking-wide">
            {featured.tema}
          </h2>

          <blockquote className="p-5 sm:p-7 rounded-2xl bg-[#081229]/90 border-l-4 border-[#eed59b] border border-[#5b9bd5]/20 shadow-inner space-y-3">
            <p className="text-lg sm:text-2xl font-serif italic text-white leading-relaxed">
              &ldquo;{featured.frase}&rdquo;
            </p>
            <footer className="text-xs sm:text-sm font-sans text-[#eed59b] flex items-center gap-2 font-medium">
              <span>— {featured.autor}</span>
              <span className="text-[#94a3b8]">•</span>
              <cite className="not-italic text-[#94a3b8] font-normal">{featured.origen}</cite>
            </footer>
          </blockquote>

          <div className="p-4 sm:p-5 rounded-xl bg-[#0d1733]/80 border border-[#5b9bd5]/20 space-y-1.5">
            <span className="text-xs font-sans text-[#60a5fa] font-semibold flex items-center gap-1.5">
              <span>✦</span>
              <span>Aplicación Práctica para Hoy</span>
            </span>
            <p className="text-xs sm:text-sm text-[#94a3b8] leading-relaxed font-sans">
              {featured.reflexion}
            </p>
          </div>
        </div>
      </div>

      {/* Sección de Catálogo / Exploración de Reflexiones */}
      <div id="catalogo" className="space-y-4 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-lg sm:text-xl font-serif font-bold text-white tracking-wide">
              Catálogo de Sabiduría (365 Días)
            </h3>
            <p className="text-xs text-[#94a3b8]">
              Explora pensamientos de Marco Aurelio, Séneca, David Goggins, Buda, Brian Tracy, Napoleon Hill y Rockefeller.
            </p>
          </div>

          <span className="tag-formal text-xs bg-[#1e3a8a]/40 text-[#93c5fd] border border-[#60a5fa]/30 px-3.5 py-1.5 rounded-full self-start sm:self-auto font-medium">
            {filteredList.length} Reflexiones Disponibles
          </span>
        </div>

        {/* Buscador estilizado */}
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94a3b8]">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Buscar por concepto: serenidad, foco, disciplina, perseverancia, calma, esfuerzo..."
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setVisibleCount(12);
            }}
            className="w-full pl-11 pr-4 py-3 rounded-full text-xs font-sans bg-[#081229] border border-[#5b9bd5]/30 text-white placeholder-[#94a3b8]/50 focus:border-[#eed59b] focus:outline-none"
          />
        </div>

        {/* Filtros de Autores en Cápsulas */}
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
                className={`px-3.5 py-1.5 rounded-full text-xs transition-all ${
                  isActive
                    ? 'bg-[#2563eb] text-white font-medium shadow-midnight'
                    : 'bg-[#0d1733] text-[#94a3b8] hover:text-white border border-[#5b9bd5]/20'
                }`}
              >
                {autor}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid de Tarjetas de Reflexión */}
      {displayedList.length === 0 ? (
        <div className="card-midnight p-10 text-center space-y-2 border border-dashed border-[#5b9bd5]/20">
          <p className="text-sm font-serif font-bold text-white">No se encontraron reflexiones</p>
          <p className="text-xs text-[#94a3b8]">Prueba con otro término de búsqueda o selecciona &quot;Todos&quot;.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedList.map((item) => (
            <div
              key={item.dia}
              className="card-midnight p-5 border border-[#5b9bd5]/20 hover:border-[#5b9bd5]/45 transition-all flex flex-col justify-between space-y-3 group"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="tag-formal text-[10px] bg-[#070e1e] text-[#94a3b8] px-2.5 py-0.5 rounded-full border border-[#5b9bd5]/25">
                    Día {item.dia}
                  </span>
                  <span className={`tag-formal text-[10px] px-2.5 py-0.5 rounded-full border ${getCategoryBadge(item.categoria)}`}>
                    {item.categoria}
                  </span>
                </div>

                <h4 className="text-sm font-serif font-bold text-white tracking-wide">
                  {item.tema}
                </h4>

                <p className="text-sm font-serif italic text-white leading-relaxed">
                  &ldquo;{item.frase}&rdquo;
                </p>

                <p className="text-xs text-[#94a3b8] leading-relaxed pt-1.5 border-t border-[#5b9bd5]/15 font-sans">
                  <span className="text-[#eed59b] font-medium">↳</span> {item.reflexion}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#5b9bd5]/15 text-xs">
                <div className="text-[#eed59b] truncate pr-2 font-medium">
                  <span>{item.autor}</span>
                  <span className="text-[#94a3b8] ml-1 font-normal text-[11px]">({item.origen})</span>
                </div>

                <button
                  onClick={() => handleCopyQuote(item)}
                  className="p-1.5 rounded-full text-[#94a3b8] hover:text-white hover:bg-[#0d1733] transition-colors"
                  title="Copiar cita"
                >
                  {copiedId === item.dia ? (
                    <span className="text-[10px] text-[#eed59b] font-bold">✓</span>
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

      {/* Botón Cargar Más */}
      {visibleCount < filteredList.length && (
        <div className="text-center pt-2">
          <button
            onClick={() => setVisibleCount((prev) => prev + 12)}
            className="btn-formal-outline px-6 py-2.5 rounded-full text-xs font-medium"
          >
            Cargar más reflexiones ({filteredList.length - visibleCount} restantes)
          </button>
        </div>
      )}
    </div>
  );
};
