import type { ComponentProps } from 'react';

/** Acción principal: misma apariencia y comportamiento nativo en toda la app. */
export default function Button({ className = '', type = 'button', ...props }: ComponentProps<'button'>) {
  return <button type={type} className={['primary', className].filter(Boolean).join(' ')} {...props} />;
}
