import React from 'react';

interface EnsoLogoProps {
  className?: string;
  size?: number | string;
}

export const EnsoLogo: React.FC<EnsoLogoProps> = ({ className = 'w-9 h-9', size }) => {
  return (
    <img
      src="/enso-circle-white.svg"
      alt="Arco del Punto y Aparte"
      className={`inline-block object-contain select-none drop-shadow-[0_0_12px_rgba(255,255,255,0.25)] transition-transform duration-500 hover:rotate-12 ${className}`}
      style={size ? { width: size, height: size } : undefined}
      draggable={false}
    />
  );
};

export default EnsoLogo;
