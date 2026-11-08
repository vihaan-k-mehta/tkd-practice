import { Settings } from 'lucide-preact';

export function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <main class="screen">
      <header class="topbar">
        <h1>{title}</h1>
        <a class="icon-btn" href="#/settings" aria-label="Settings">
          <Settings size={24} strokeWidth={1.75} aria-hidden="true" />
        </a>
      </header>
      <p class="empty">{note}</p>
    </main>
  );
}
