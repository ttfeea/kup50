import { PropsWithChildren } from 'react';

type PanelProps = PropsWithChildren<{
  className?: string;
}>;

export function Panel({ children, className = '' }: PanelProps) {
  return (
    <section
      className={`rounded-lg border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {children}
    </section>
  );
}
