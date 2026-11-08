import { Header } from './Today';

export function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <main class="screen">
      <Header title={title} />
      <p class="empty">{note}</p>
    </main>
  );
}
