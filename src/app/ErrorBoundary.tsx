import { Component, type ReactNode } from 'react';

interface State { message: string | null }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { message: null };

  static getDerivedStateFromError(error: unknown): State {
    return { message: error instanceof Error ? error.message : 'Неизвестная ошибка интерфейса' };
  }

  render() {
    if (!this.state.message) return this.props.children;
    return (
      <div className="screen">
        <div className="panel">
          <h2>Что-то сломалось</h2>
          <p>{this.state.message}</p>
          <button className="btn" onClick={() => window.location.reload()}>Обновить страницу</button>
        </div>
      </div>
    );
  }
}
