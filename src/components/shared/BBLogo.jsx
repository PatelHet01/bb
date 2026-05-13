import { useRef } from 'react'
import bbLogoImg from '../../../materials/Daily Post_20260506_023418_0000.png'

/**
 * BBLogo — Animated brand mark for Bombay Bethak using the original image
 * Includes pulsing glow and shimmer sweep.
 * Props:
 *   size     — overall px size of the square logo block (default 40)
 *   animate  — run the shimmer loop (default true)
 *   className — extra classes on the wrapper
 */
export default function BBLogo({ size = 40, animate = true, className = '' }) {
  const id = useRef(`bb-${Math.random().toString(36).slice(2, 7)}`)
  const uid = id.current

  return (
    <div
      className={`relative flex items-center justify-center select-none ${className} ${uid}-wrapper`}
      style={{ width: size, height: size, flexShrink: 0 }}
    >
      <style>{`
        @keyframes ${uid}-pulse-glow {
          0%, 100% { box-shadow: 0 0 15px 0px rgba(255, 255, 255, 0.1); transform: scale(1) translateY(0); }
          50% { box-shadow: 0 10px 30px 5px rgba(255, 255, 255, 0.2); transform: scale(1.03) translateY(-2px); }
        }
        @keyframes ${uid}-shimmer {
          0% { transform: translateX(-150%) skewX(-25deg); }
          50%, 100% { transform: translateX(250%) skewX(-25deg); }
        }
        .${uid}-wrapper {
          perspective: 1000px;
        }
        .${uid}-inner {
          transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
          transform-style: preserve-3d;
        }
        .${uid}-wrapper:hover .${uid}-inner {
          transform: scale(1.05) rotateY(10deg) rotateX(5deg);
        }
      `}</style>

      {/* Container with animation */}
      <div 
        className={`w-full h-full relative rounded-2xl overflow-hidden bg-[#2D2D2D] ${uid}-inner`}
        style={{
          animation: animate ? `${uid}-pulse-glow 3s ease-in-out infinite` : 'none',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        <img 
          src={bbLogoImg} 
          alt="Bombay Bethak Logo" 
          className="w-full h-full object-cover"
          style={{ transform: 'scale(1.02)' }}
        />

        {/* Shimmer overlay */}
        {animate && (
          <div 
            className="absolute top-0 bottom-0 z-10 pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
              width: '40%',
              left: 0,
              animation: `${uid}-shimmer 3s infinite cubic-bezier(0.4, 0, 0.2, 1)`,
            }}
          />
        )}
      </div>
    </div>
  )
}
