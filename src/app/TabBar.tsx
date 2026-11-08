import { CalendarDays, Dumbbell, House, Swords, Trophy } from 'lucide-preact';
type Route = string;

const tabs = [
  { id: 'today', label: 'Today', Icon: House },
  { id: 'routines', label: 'Routines', Icon: Dumbbell },
  { id: 'schedule', label: 'Schedule', Icon: CalendarDays },
  { id: 'quests', label: 'Quests', Icon: Swords },
  { id: 'ranks', label: 'Ranks', Icon: Trophy },
] as const;

export function TabBar({ route }: { route: Route }) {
  return (
    <nav class="tabbar" aria-label="Main">
      {tabs.map(({ id, label, Icon }) => (
        <a class="tab" href={`#/${id}`} aria-current={route === id ? 'page' : undefined}>
          <Icon size={24} strokeWidth={2} aria-hidden="true" />
          <span>{label}</span>
        </a>
      ))}
    </nav>
  );
}
