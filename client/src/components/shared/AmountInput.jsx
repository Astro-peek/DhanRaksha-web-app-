import React, { useState, useRef } from 'react';

const AmountInput = ({ value, onChange, onBlur, placeholder = '0', min, max, label, error, id, disabled, helperText }) => {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  const formatDisplay = (val) => {
    if (!val && val !== 0) return '';
    const num = parseFloat(String(val).replace(/,/g, ''));
    if (isNaN(num)) return '';
    return num.toLocaleString('en-IN');
  };

  const handleChange = (e) => {
    const raw = e.target.value.replace(/,/g, '').replace(/[^0-9.]/g, '');
    if (raw === '' || raw === '.') { onChange(raw); return; }
    const num = parseFloat(raw);
    if (!isNaN(num)) onChange(num);
  };

  const displayValue = focused ? (value ?? '') : (value ? formatDisplay(value) : '');

  return (
    <div className="w-full">
      {label && <label htmlFor={id} className="block text-xs font-semibold text-brand-textMuted uppercase tracking-wide mb-1.5">{label}</label>}
      <div
        className={`relative flex items-center rounded-input border bg-white transition-all duration-200 ${
          error ? 'border-brand-error ring-4 ring-brand-error/10' :
          focused ? 'border-brand-primary ring-4 ring-brand-primary/10' :
          'border-slate-200'
        } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}
        onClick={() => inputRef.current?.focus()}
      >
        <span className="pl-4 pr-1 text-sm font-bold text-brand-primary select-none">₹</span>
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="decimal"
          disabled={disabled}
          placeholder={placeholder}
          value={displayValue}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); onBlur?.(); }}
          className="flex-1 pr-4 py-2.5 bg-transparent text-sm font-semibold text-brand-textPrimary placeholder:text-slate-300 focus:outline-none"
          aria-label={label || 'Amount in rupees'}
          aria-describedby={error ? `${id}-error` : helperText ? `${id}-hint` : undefined}
        />
      </div>
      {error && <p id={`${id}-error`} className="mt-1 text-xs text-brand-error font-medium" role="alert">{error}</p>}
      {helperText && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-brand-textMuted">{helperText}</p>}
      {min !== undefined && max !== undefined && value && (
        <p className={`mt-1 text-xs font-medium ${Number(value) < min || Number(value) > max ? 'text-brand-error' : 'text-brand-success'}`}>
          {Number(value) < min ? `Minimum: ₹${min.toLocaleString('en-IN')}` :
           Number(value) > max ? `Maximum: ₹${max.toLocaleString('en-IN')}` :
           `✓ Valid amount`}
        </p>
      )}
    </div>
  );
};

export default AmountInput;
