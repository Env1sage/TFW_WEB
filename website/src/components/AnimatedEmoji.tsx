import { useState, useCallback } from 'react';

type AnimType = 'wiggle' | 'bounce' | 'float' | 'heart';

interface Props {
  emoji: string;
  anim?: AnimType;
  trigger?: 'hover' | 'click' | 'auto';
  size?: string;
  className?: string;
}

const animClass: Record<AnimType, string> = {
  wiggle: 'playing-wiggle',
  bounce: 'playing-bounce',
  float:  'playing-float',
  heart:  'playing-heart',
};

export function AnimatedEmoji({ emoji, anim = 'bounce', trigger = 'hover', size = '1em', className = '' }: Props) {
  const [active, setActive] = useState(trigger === 'auto');

  const play = useCallback(() => setActive(true), []);
  const stop = useCallback(() => { if (trigger !== 'auto') setActive(false); }, [trigger]);

  return (
    <span
      className={`anim-emoji ${active ? animClass[anim] : ''} ${className}`}
      style={{ fontSize: size, willChange: 'transform' }}
      onMouseEnter={() => trigger === 'hover' && play()}
      onMouseLeave={() => trigger === 'hover' && stop()}
      onClick={() => trigger === 'click' && play()}
      onAnimationEnd={() => trigger !== 'auto' && setActive(false)}
    >
      {emoji}
    </span>
  );
}
