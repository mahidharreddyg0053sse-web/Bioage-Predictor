import React from 'react';

export function PhishGuardLogo({ compact = false }) {
  return (
    <div className={`flex ${compact ? 'flex-row items-center gap-2.5' : 'flex-col items-center gap-2'}`}>
      <div className="relative flex items-center justify-center">
        <svg
          width={compact ? 36 : 54}
          height={compact ? 38 : 58}
          viewBox="0 0 64 68"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="PhishGuard Shield Logo"
        >
          {/* Outer Blue Shield */}
          <path
            d="M32 4L8 13.5V31.5C8 47.4 18.2 61.1 32 65C45.8 61.1 56 47.4 56 31.5V13.5L32 4Z"
            fill="#EFF6FF"
            stroke="#1877F2"
            strokeWidth="4.2"
            strokeLinejoin="round"
          />
          {/* Inner Crisp Shield Border */}
          <path
            d="M32 9.5L13 17V31.2C13 44.1 21 55.2 32 58.6C43 55.2 51 44.1 51 31.2V17L32 9.5Z"
            fill="#FFFFFF"
            stroke="#BFDBFE"
            strokeWidth="1.5"
          />
          {/* Padlock Shackle */}
          <path
            d="M25.5 29V24.5C25.5 20.91 28.41 18 32 18C35.59 18 38.5 20.91 38.5 24.5V29"
            stroke="#0F172A"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          {/* Padlock Body */}
          <rect x="21.5" y="28.5" width="21" height="17" rx="3.5" fill="#0F172A" />
          {/* Keyhole */}
          <circle cx="32" cy="35.5" r="2.2" fill="#FFFFFF" />
          <path d="M32 37.2V41" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </div>
      <span
        className={`font-extrabold tracking-tight text-[#1877F2] ${
          compact ? 'text-xl' : 'text-[23px] leading-none'
        }`}
      >
        PhishGuard
      </span>
    </div>
  );
}
