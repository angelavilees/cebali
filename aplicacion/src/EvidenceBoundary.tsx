import { Component } from "react";
import type { ReactNode } from "react";
import Icon from "./Icons";

export default class EvidenceBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <section className="evidence-loading" role="alert">
          <Icon name="help" size={32} />
          <h2>No pudimos cargar los gráficos</h2>
          <p>Comprueba que la aplicación siga abierta y vuelve a cargarla.</p>
          <button className="primary" onClick={() => window.location.reload()}>
            Volver a cargar
          </button>
        </section>
      );
    return this.props.children;
  }
}
