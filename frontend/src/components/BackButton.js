import React from 'react';
import { useNavigate } from 'react-router-dom';

const BackButton = ({ label = 'Back', className = '' }) => {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className={`inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] transition-colors hover:opacity-70 ${className}`}
    >
      <span aria-hidden="true" className="text-lg leading-none">&lt;</span>
      <span>{label}</span>
    </button>
  );
};

export default BackButton;
