import type { ComponentProps, ReactNode } from 'react';
import Icon from '../../Icons';
import type { IconName } from '../../Icons';
import { revealDisclosure } from './revealDisclosure';

type DisclosureProps = Omit<ComponentProps<'details'>, 'title'> & {
  icon: IconName;
  title: ReactNode;
};

/** Panel nativo: teclado, apertura, flecha y espaciado compartidos. */
export default function Disclosure({ icon, title, className = '', children, onToggle, ...props }: DisclosureProps) {
  return <details className={['evidence-disclosure', className].filter(Boolean).join(' ')} {...props}
    onToggle={event => { revealDisclosure(event.currentTarget); onToggle?.(event); }}>
    <summary><Icon name={icon} />{title}<Icon name="chevron" size={18} /></summary>
    <div className="evidence-inside">{children}</div>
  </details>;
}
