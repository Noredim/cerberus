import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
}

export function Tooltip({ children, content }: TooltipProps) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

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
            className="absolute z-[999999] bg-[#1e293b] text-white text-xs rounded-lg shadow-xl p-3 min-w-[200px]"
            style={{
              left: Math.max(10, coords.x), // Prevent clipping on extreme left 
              top: Math.max(10, coords.y), // Prevent clipping extreme top
              transform: 'translate(-50%, -100%)',
            }}
          >
            {content}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-[#1e293b]" />
          </div>,
          document.body
        )}
    </div>
  );
}
