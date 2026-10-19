import { useEffect, useRef, useState } from 'react';
import Icon from './Icons';

/** Entrada de marca, sin indicadores que finjan trabajo del modelo. */
export default function Welcome({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const done = useRef(onDone);
  const welcome = useRef<HTMLElement>(null);
  useEffect(() => { done.current = onDone; }, [onDone]);
  useEffect(() => {
    const finish = () => {
      try { sessionStorage.setItem('cebali:welcome:v1', 'seen'); } catch { /* La entrada también funciona con almacenamiento bloqueado. */ }
      done.current();
    };
    welcome.current?.focus({ preventScroll: true });
    const leave = window.setTimeout(() => setLeaving(true), 2100);
    const close = window.setTimeout(finish, 2550);
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reduce = () => { if (preference.matches) finish(); };
    preference.addEventListener('change', reduce);
    return () => { clearTimeout(leave); clearTimeout(close); preference.removeEventListener('change', reduce); };
  }, []);
  function skip() {
    try { sessionStorage.setItem('cebali:welcome:v1', 'seen'); } catch { /* Sin persistencia, seguimos entrando. */ }
    onDone();
  }
  return <section ref={welcome} tabIndex={-1} className={`welcome${leaving ? ' is-leaving' : ''}`} aria-label="Bienvenido a Cebali" onKeyDown={event => { if (event.key === 'Escape') skip(); }}>
    <div className="welcome-grain" aria-hidden="true" />
    <div className="welcome-topline"><Icon name="leaf" size={20} /><span>HECHO PARA TU CAMPO</span></div>
    <div className="welcome-world" aria-hidden="true">
      <span className="welcome-sun" /><span className="welcome-orbit" />
      <span className="welcome-cloud cloud-left" /><span className="welcome-cloud cloud-right" />
      <span className="welcome-hill hill-back" /><span className="welcome-hill hill-front" />
      <div className="welcome-crop crop-left"><Icon name="wheat" size={84} /></div>
      <div className="welcome-crop crop-right"><Icon name="wheat" size={110} /></div>
      <span className="welcome-spark spark-one" /><span className="welcome-spark spark-two" /><span className="welcome-spark spark-three" />
      <img className="welcome-mascot" src={`${import.meta.env.BASE_URL}cebali-mascot.webp`} alt="" fetchPriority="high" draggable={false} />
    </div>
    <div className="welcome-brand"><h2>Cebali<span>.</span></h2><p>Tu campo tiene mucho<br /><strong>que contar.</strong></p></div>
    <button className="welcome-enter" onClick={skip}>Entrar a mi campo<Icon name="chevron" size={18} /></button>
  </section>;
}
