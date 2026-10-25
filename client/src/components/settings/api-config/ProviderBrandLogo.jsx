import React from 'react';

/**
 * High-fidelity SVG brand logos for supported AI providers.
 * Explicit width/height attributes and inline styles guarantee crisp visibility.
 * Monochrome marks use currentColor to seamlessly adapt between dark and light themes.
 */
export function BrandLogoBadge({ id, color, name, size = 15, tileSize = 28, className = '', style = {} }) {
  return (
    <div
      className={`brand-logo-tile ${className}`}
      style={{
        width: `${tileSize}px`,
        height: `${tileSize}px`,
        minWidth: `${tileSize}px`,
        minHeight: `${tileSize}px`,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        userSelect: 'none',
        ...style,
      }}
    >
      <ProviderBrandLogo id={id} color={color} name={name} size={size} />
    </div>
  );
}

export default function ProviderBrandLogo({ id, color, name, size = 16 }) {
  const c = color || 'currentColor';
  const svgProps = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    style: {
      width: `${size}px`,
      height: `${size}px`,
      minWidth: `${size}px`,
      minHeight: `${size}px`,
      display: 'block',
      flexShrink: 0,
    },
  };

  switch (id) {
    case 'google':
      // Official Google 4-color emblem
      return (
        <svg {...svgProps} aria-label="Google Gemini">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
        </svg>
      );

    case 'openai':
      // Official OpenAI signature spiral bloom — adapts with currentColor
      return (
        <svg {...svgProps} fill="currentColor" aria-label="OpenAI">
          <path d="M22.28 9.82a5.98 5.98 0 0 0-.52-4.91 6.05 6.05 0 0 0-6.5-2.9A6.06 6.06 0 0 0 4.98 4.18a5.98 5.98 0 0 0-4 2.9 6.05 6.05 0 0 0 .74 7.1 5.98 5.98 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.51 2.9A5.98 5.98 0 0 0 13.26 24a6.05 6.05 0 0 0 5.77-4.2 5.99 5.99 0 0 0 4-2.9 6.05 6.05 0 0 0-.75-7.08zm-9.02 12.61a4.48 4.48 0 0 1-2.88-1.04l.14-.08 4.78-2.76a.8.8 0 0 0 .39-.68v-6.74l2.02 1.17a.07.07 0 0 1 .04.05v5.58a4.5 4.5 0 0 1-4.49 4.5zm-9.66-4.13a4.47 4.47 0 0 1-.53-3.01l.14.08 4.78 2.76a.77.77 0 0 0 .78 0l5.84-3.37v2.33a.08.08 0 0 1-.03.06L9.74 19.95a4.5 4.5 0 0 1-6.14-1.65zM2.34 7.9a4.48 4.48 0 0 1 2.37-1.98v5.68a.77.77 0 0 0 .38.68l5.82 3.35-2.02 1.17a.08.08 0 0 1-.07 0l-4.83-2.79A4.5 4.5 0 0 1 2.34 7.9zm16.6 3.85l-5.84-3.38 2.02-1.17a.08.08 0 0 1 .07 0l4.83 2.79a4.5 4.5 0 0 1-.68 8.1v-5.67a.8.8 0 0 0-.4-.67zm2.01-3.02l-.14-.09-4.77-2.78a.78.78 0 0 0-.79 0L9.41 9.23V6.9a.07.07 0 0 1 .03-.06l4.83-2.79a4.5 4.5 0 0 1 6.68 4.66zM8.31 12.86l-2.02-1.16a.08.08 0 0 1-.04-.06V6.07a4.5 4.5 0 0 1 7.38-3.45l-.14.08-4.79 2.76a.8.8 0 0 0-.39.68zm1.1-2.36l2.6-1.5 2.61 1.5v3l-2.6 1.5-2.61-1.5z" />
        </svg>
      );

    case 'anthropic':
      // Official Anthropic geometric A mark
      return (
        <svg {...svgProps} fill="currentColor" aria-label="Anthropic">
          <path d="M13.83 4.22h3.58L24 19.78h-3.58l-1.57-3.48h-5.69l-1.57 3.48H8.01L13.83 4.22zm1.79 4.35l-2.07 4.57h4.14l-2.07-4.57zM3.58 19.78L0 19.78 5.82 4.22h3.58l-5.82 15.56z" />
        </svg>
      );

    case 'mistral':
      // Official Mistral orange pixel chevron
      return (
        <svg {...svgProps} fill="#FF7000" aria-label="Mistral AI">
          <rect x="2" y="4" width="4" height="4" rx="0.5" />
          <rect x="18" y="4" width="4" height="4" rx="0.5" />
          <rect x="2" y="9" width="4" height="4" rx="0.5" />
          <rect x="6" y="9" width="4" height="4" rx="0.5" />
          <rect x="14" y="9" width="4" height="4" rx="0.5" />
          <rect x="18" y="9" width="4" height="4" rx="0.5" />
          <rect x="2" y="14" width="4" height="4" rx="0.5" />
          <rect x="6" y="14" width="4" height="4" rx="0.5" />
          <rect x="10" y="14" width="4" height="4" rx="0.5" />
          <rect x="14" y="14" width="4" height="4" rx="0.5" />
          <rect x="18" y="14" width="4" height="4" rx="0.5" />
        </svg>
      );

    case 'groq':
      // Groq stylized slash circle in signature Groq orange-red
      return (
        <svg {...svgProps} fill="none" stroke="#F55036" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-label="Groq">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 16a4 4 0 1 0-4-4" />
          <path d="M12 8v4h4" />
        </svg>
      );

    case 'huggingface':
      // Hugging Face signature 🤗 emoji face
      return (
        <svg {...svgProps} aria-label="Hugging Face">
          <circle cx="12" cy="12" r="9.5" fill="#FFD21E" />
          <ellipse cx="8.5" cy="10.5" rx="1.2" ry="1.6" fill="#2D2D2D" />
          <ellipse cx="15.5" cy="10.5" rx="1.2" ry="1.6" fill="#2D2D2D" />
          <path d="M8.2 14.5c1.1 1.6 2.4 2.2 3.8 2.2s2.7-.6 3.8-2.2" fill="none" stroke="#2D2D2D" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M4.5 13.5c-.7.7-.7 1.8 0 2.5l1.6 1.6c.7.7 1.8.7 2.5 0" fill="none" stroke="#FF9D00" strokeWidth="1.4" strokeLinecap="round" />
          <path d="M19.5 13.5c.7.7.7 1.8 0 2.5l-1.6 1.6c-.7.7-1.8.7-2.5 0" fill="none" stroke="#FF9D00" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );

    case 'deepseek':
      // DeepSeek blue leaping dolphin
      return (
        <svg {...svgProps} fill="#4D6CFA" aria-label="DeepSeek">
          <path d="M18.8 4c-3.1 0-5.8 2-6.8 4.9C11 9 10 9 9 9.3 5 10.4 2 14.1 2 18.5c2.3-1.6 5.1-2.5 8-2.5 2.1 0 4.1.5 5.9 1.5.8-2.6 3.2-4.5 6.1-4.5.3 0 .7 0 1 .1C22.6 8 20.9 4 18.8 4z" />
          <circle cx="17.2" cy="8.2" r="1.1" fill="#ffffff" />
        </svg>
      );

    case 'together':
      // Together AI interlocking blue circles
      return (
        <svg {...svgProps} fill="none" stroke="#0070F3" strokeWidth="2.4" aria-label="Together AI">
          <circle cx="8.5" cy="12" r="4.8" />
          <circle cx="15.5" cy="12" r="4.8" />
        </svg>
      );

    case 'perplexity':
      // Perplexity woven knot
      return (
        <svg {...svgProps} fill="none" stroke="#20808D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Perplexity">
          <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07L19.07 4.93" />
          <circle cx="12" cy="12" r="2.8" fill="#20808D" />
        </svg>
      );

    case 'cerebras':
      // Cerebras wafer chip grid
      return (
        <svg {...svgProps} fill="none" stroke="#34D399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Cerebras">
          <rect x="4" y="4" width="16" height="16" rx="2.5" />
          <rect x="9" y="9" width="6" height="6" rx="1" fill="#34D399" />
          <path d="M4 9h2M4 15h2M18 9h2M18 15h2M9 4v2M15 4v2M9 18v2M15 18v2" />
        </svg>
      );

    case 'azure':
      // Microsoft Azure 4-square
      return (
        <svg {...svgProps} aria-label="Azure OpenAI">
          <rect x="2.5" y="2.5" width="8.5" height="8.5" fill="#F25022" rx="0.5" />
          <rect x="13" y="2.5" width="8.5" height="8.5" fill="#7FBA00" rx="0.5" />
          <rect x="2.5" y="13" width="8.5" height="8.5" fill="#00A4EF" rx="0.5" />
          <rect x="13" y="13" width="8.5" height="8.5" fill="#FFB900" rx="0.5" />
        </svg>
      );

    case 'aws':
      // AWS smile & compute cube
      return (
        <svg {...svgProps} fill="#FF9900" aria-label="AWS Bedrock">
          <path d="M5.5 15.5c4 2.8 7.5 2.8 11 0 .4-.3.9.1.7.5-1.5 2.5-5.5 4.5-9.5 2-1-.7-1.8-1.7-2.9-2-.4-.1-.5-.7-.1-.9l.8.4zM4 8.5l3.5-2c.4-.2.9.1.9.5v6c0 .4-.5.7-.9.5L4 11.5c-.4-.2-.8-.6-.8-1.1v-.8c0-.5.4-.9.8-1.1zm8-4.5l3.5-2c.4-.2.9.1.9.5v6c0 .4-.5.7-.9.5L12 7c-.4-.2-.8-.6-.8-1.1v-.8c0-.5.4-.9.8-1.1z" />
        </svg>
      );

    case 'workers':
      // Cloudflare cloud
      return (
        <svg {...svgProps} fill="#F38020" aria-label="Cloudflare AI">
          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
        </svg>
      );

    case 'ollama':
      // Ollama llama mark — adapts with currentColor
      return (
        <svg {...svgProps} fill="currentColor" aria-label="Ollama">
          <path d="M12 2a4 4 0 0 0-4 4v3.2c-.8.5-1.5 1.3-1.8 2.2L4 16v3h2v-1.5l1.6-3.2c.4-.8 1.2-1.3 2.1-1.3h4.6c.9 0 1.7.5 2.1 1.3L18 17.5V19h2v-3l-2.2-4.6c-.3-.9-1-1.7-1.8-2.2V6a4 4 0 0 0-4-4zm-1.5 5a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm3 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
        </svg>
      );

    case 'nvidia':
      // NVIDIA green eye
      return (
        <svg {...svgProps} fill="#76B900" aria-label="NVIDIA NIM">
          <path d="M8.9 7.4c0-1.8 1.4-3.3 3.1-3.3 1.7 0 3.1 1.5 3.1 3.3v.8c2.1.2 3.8 2 3.8 4.2 0 2.3-1.9 4.2-4.2 4.2H8.3C5.9 16.6 4 14.7 4 12.3c0-2.2 1.6-4 3.7-4.3v-.6zm0 2.3c-.9.3-1.6 1.1-1.6 2.1 0 1.2 1 2.2 2.2 2.2h5.1c1.2 0 2.2-1 2.2-2.2 0-1.2-1-2.2-2.2-2.2H8.9v.1z" />
        </svg>
      );

    case 'xai':
      // xAI Grok X mark — adapts with currentColor
      return (
        <svg {...svgProps} fill="currentColor" aria-label="xAI">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      );

    case 'elevenlabs':
      // ElevenLabs || mark
      return (
        <svg {...svgProps} fill="currentColor" aria-label="ElevenLabs">
          <rect x="7" y="4" width="3" height="16" rx="1.5" />
          <rect x="14" y="4" width="3" height="16" rx="1.5" />
        </svg>
      );

    case 'openrouter':
      // OpenRouter multi-directional route — adapts with currentColor
      return (
        <svg {...svgProps} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-label="OpenRouter">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" />
        </svg>
      );

    case 'cohere':
      // Cohere pebble cells — adapts with currentColor
      return (
        <svg {...svgProps} fill="currentColor" aria-label="Cohere">
          <ellipse cx="9" cy="9" rx="5" ry="4" transform="rotate(-15 9 9)" />
          <ellipse cx="15" cy="14" rx="5" ry="4" transform="rotate(25 15 14)" />
        </svg>
      );

    case 'replicate':
      // Replicate step lines — adapts with currentColor
      return (
        <svg {...svgProps} fill="currentColor" aria-label="Replicate">
          <path d="M3 4h18v3.5H3V4zm0 6h12v3.5H3V10zm0 6h6v3.5H3V16z" />
        </svg>
      );

    case 'fal':
      // fal.ai geometric F
      return (
        <svg {...svgProps} fill="#FF4B4B" aria-label="fal.ai">
          <path d="M4 4h16v3.5H8v3.5h10v3.5H8V20H4V4z" />
        </svg>
      );

    case 'stability':
      // Stability AI ring spark
      return (
        <svg {...svgProps} fill="none" stroke="#7C3AED" strokeWidth="2.2" strokeLinecap="round" aria-label="Stability AI">
          <circle cx="12" cy="12" r="7.5" />
          <circle cx="12" cy="12" r="2.8" fill="#7C3AED" />
        </svg>
      );

    case 'sambanova':
      // SambaNova S flow
      return (
        <svg {...svgProps} fill="none" stroke="#EC4899" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-label="SambaNova">
          <path d="M17 7.5A4.5 4.5 0 0 0 12.5 3H7v7.5a4.5 4.5 0 0 0 4.5 4.5H17V21H7" />
        </svg>
      );

    case 'novita':
      // Novita AI geometric prism
      return (
        <svg {...svgProps} fill="none" stroke="#0284c7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-label="Novita AI">
          <polygon points="12 2 21 8.5 21 15.5 12 22 3 15.5 3 8.5" />
          <line x1="12" y1="22" x2="12" y2="12" />
          <line x1="12" y1="12" x2="21" y2="8.5" />
          <line x1="12" y1="12" x2="3" y2="8.5" />
        </svg>
      );

    case 'fireworks':
      // Fireworks AI spark
      return (
        <svg {...svgProps} fill="none" stroke="#FF4E1A" strokeWidth="2.2" strokeLinecap="round" aria-label="Fireworks AI">
          <path d="M12 2v5M12 17v5M2 12h5M17 12h5M4.93 4.93l3.54 3.54M15.54 15.54l3.53 3.53M4.93 19.07l3.54-3.54M15.54 8.46l3.53-3.53" />
        </svg>
      );

    case 'deepinfra':
      // Deep Infra compute layers
      return (
        <svg {...svgProps} fill="none" stroke="#0EA5E9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="Deep Infra">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      );

    case 'lepton':
      // Lepton AI orbital atom
      return (
        <svg {...svgProps} fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" aria-label="Lepton AI">
          <circle cx="12" cy="12" r="2.5" fill="#3B82F6" />
          <ellipse cx="12" cy="12" rx="8" ry="3.5" transform="rotate(45 12 12)" />
          <ellipse cx="12" cy="12" rx="8" ry="3.5" transform="rotate(-45 12 12)" />
        </svg>
      );

    case 'voyage':
      // Voyage AI compass V
      return (
        <svg {...svgProps} fill="none" stroke="#0066CC" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-label="Voyage AI">
          <polygon points="3 11 22 2 13 21 11 13 3 11" fill="rgba(0, 102, 204, 0.2)" />
        </svg>
      );

    case 'anyscale':
      // Anyscale ray burst
      return (
        <svg {...svgProps} fill="none" stroke="#00B4D8" strokeWidth="2.2" strokeLinecap="round" aria-label="Anyscale">
          <line x1="12" y1="3" x2="12" y2="21" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="5.64" y1="5.64" x2="18.36" y2="18.36" />
        </svg>
      );

    case 'runpod':
      // RunPod cube pod
      return (
        <svg {...svgProps} fill="none" stroke="#673AB7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="RunPod">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      );

    case 'upstage':
      // Upstage solar U
      return (
        <svg {...svgProps} fill="none" stroke="#7C3AED" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-label="Upstage">
          <path d="M6 4v8a6 6 0 0 0 12 0V4" />
          <polyline points="15 7 18 4 21 7" />
        </svg>
      );

    case 'ai21':
      // AI21 Labs polygon
      return (
        <svg {...svgProps} fill="none" stroke="#6C3FB5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-label="AI21 Labs">
          <polygon points="6 3 18 3 22 12 18 21 6 21 2 12" />
          <path d="M10 8v8M14 8h2a2 2 0 0 1 0 4h-2m2 0a2 2 0 0 1 0 4h-2" />
        </svg>
      );

    case 'vllm':
      // vLLM speed V
      return (
        <svg {...svgProps} fill="none" stroke="#34D399" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-label="vLLM">
          <polyline points="4 6 12 20 20 6" />
          <polyline points="8 6 12 14 16 6" />
        </svg>
      );

    case 'lmstudio':
      // LM Studio orbital brain
      return (
        <svg {...svgProps} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-label="LM Studio">
          <circle cx="12" cy="12" r="3.5" fill="#3b82f6" />
          <ellipse cx="12" cy="12" rx="8" ry="4" transform="rotate(30 12 12)" />
          <ellipse cx="12" cy="12" rx="8" ry="4" transform="rotate(-30 12 12)" />
        </svg>
      );

    default: {
      // Fallback: Clean 2-letter monogram
      const clean = (name || id || 'AI').replace(/\(.*?\)/g, '').replace(/[^a-zA-Z0-9 ]/g, '').trim();
      const parts = clean.split(/\s+/).filter(Boolean);
      const monogram = parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : clean.slice(0, 2).toUpperCase();
      return (
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            userSelect: 'none',
            display: 'block',
            color: 'currentColor',
          }}
        >
          {monogram}
        </span>
      );
    }
  }
}
