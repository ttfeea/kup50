import { PropsWithChildren } from 'react';

type PanelProps = PropsWithChildren<{
  className?: string;
}>;

export function Panel({ children, className = '' }: PanelProps) {
  return (
    <section
      className={`rounded-xl border p-5 border-[rgba(51, 13, 75, 0.2)] bg-[rgba(52, 14, 99, 0.45)] backdrop-blur-md ${className}`}
    >
      {children}
    </section>
  );
}