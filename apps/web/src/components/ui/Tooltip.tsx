import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  variant?: 'dark' | 'light';
}

export function Tooltip({ children, content, variant = 'dark' }: TooltipProps) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const calculatePosition = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setCoords({
        x: rect.left + rect.width / 2,
        // The Y coordinate positions the bottom edge of the tooltip 8px above the target element
        y: rect.top + window.scrollY - 8,
      });
    }
  };

  const handleEnter = () => {
    setOffset(0);
    calculatePosition();
    setShow(true);
  };

  // Recalculate if user scrolls while hovering
  useEffect(() => {
    if (!show) return;
    const onScrollOrResize = () => calculatePosition();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize, true);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize, true);
    };
  }, [show]);

  useLayoutEffect(() => {
    if (show && tooltipRef.current) {
      const rect = tooltipRef.current.getBoundingClientRect();
      
      // Calculate original bounds ignoring current offset transform
      const unoffsetedLeft = rect.left - offset;
      const unoffsetedRight = rect.right - offset;
      
      const padding = 16;
      const overflowRight = unoffsetedRight - (window.innerWidth - padding);
      const overflowLeft = padding - unoffsetedLeft;

      if (overflowRight > 0) {
        setOffset(-overflowRight);
      } else if (overflowLeft > 0) {
        setOffset(overflowLeft);
      } else {
        setOffset(0);
      }
    }
  }, [show, coords, offset]);

  return (
    <div
      ref={ref}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setShow(false)}
      className="inline-flex cursor-help relative"
    >
      {children}
      {show &&
        createPortal(
          <div
            className="absolute z-[999999]"
            style={{
              left: coords.x, 
              top: Math.max(10, coords.y), // Prevent clipping extreme top
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div 
              ref={tooltipRef}
              className={`text-xs rounded-lg shadow-xl p-3 min-w-[200px] border ${
                variant === 'light'
                  ? 'bg-white text-slate-800 border-slate-200/80 shadow-slate-200/50'
                  : 'bg-slate-900 text-slate-100 border-slate-800'
              }`}
              style={{ transform: `translateX(${offset}px)` }}
            >
              {content}
            </div>
            <div className={`absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent ${
              variant === 'light' ? 'border-t-white' : 'border-t-slate-900'
            }`} />
          </div>,
          document.body
        )}
    </div>
  );
}
