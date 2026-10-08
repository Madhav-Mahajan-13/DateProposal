import { useEffect, useState } from 'react';
import { useReducedMotion } from '../hooks/useReducedMotion';

export default function Celebration() {
  const [visible, setVisible] = useState(true);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, []);
  if (!visible || reducedMotion) return null;
  return (
    <div aria-hidden="true">
      {Array.from({ length: 15 }, (_, index) => (
        <span
          className="celebrate"
          key={index}
          style={{
            left: `${5 + ((index * 31) % 91)}%`,
            animationDelay: `${((index * 7) % 10) / 14}s`,
          }}
        >
          ♡
        </span>
      ))}
    </div>
  );
}
