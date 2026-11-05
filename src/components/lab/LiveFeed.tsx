import { useCallback, useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Mail, CalendarDays, ListChecks, ReceiptEuro, Check, Users, Workflow, Bot, Sparkles, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type MailRow = { id: string; from_name: string | null; from_address: string | null; subject: string | null; created_at: string };
type Appt = { id: string; title: string; start_at: string; client: string | null; location: string | null };
type Task = { id: string; title: string; priority: string; due_at: string | null };
type Invoice = { id: string; name: string; partner_name: string | null; amount_residual: number; currency: string | null; due_date: string | null };
type Tab = 'all' | 'mail' | 'cal' | 'task' | 'bill';

const time = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const ago = (iso: string, now: number) => { const m = Math.round((now - new Date(iso).getTime()) / 60000); return m < 1 ? "à l'instant" : m < 60 ? `il y a ${m} min` : m < 1440 ? `il y a ${Math.floor(m / 60)} h` : new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }); };
const until = (iso: string, now: number) => { const m = Math.round((new Date(iso).getTime() - now) / 60000); if (m <= 0) return 'En cours'; if (m < 60) return `Dans ${m} min`; if (m < 1440) return `Dans ${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`; return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + time(iso); };
const lateDays = (d: string) => Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000));
const money = (n: number, c?: string | null) => n.toLocaleString('fr-FR', { style: 'currency', currency: c || 'EUR', maximumFractionDigits: 0 });
const prioLabel: Record<string, string> = { high: 'Urgente', urgent: 'Urgente', medium: 'Normale', low: 'Basse' };

function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(id); }, [ms]);
  return now;
}

/** Real-time snapshot of Sendy, Calendsky, Skytask and Angelo, refreshed by Supabase Realtime. */
export function LiveFeed() {
  const now = useNow();
  const [tab, setTab] = useState<Tab>('all');
  const [unread, setUnread] = useState(0);
  const [mails, setMails] = useState<MailRow[]>([]);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [bills, setBills] = useState<Invoice[]>([]);
  const [ready, setReady] = useState(false);
  const [pulse, setPulse] = useState(0);

  const load = useCallback(async () => {
    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);
    const [m, c, a, t, b] = await Promise.all([
      supabase.from('mail_messages').select('id,from_name,from_address,subject,created_at').eq('folder', 'inbox').eq('is_read', false).order('created_at', { ascending: false }).limit(4),
      supabase.from('mail_messages').select('id', { count: 'exact', head: true }).eq('folder', 'inbox').eq('is_read', false),
      supabase.from('appointments').select('id,title,start_at,client,location').gte('end_at', nowIso).neq('status', 'annule').order('start_at').limit(4),
      supabase.from('tasks').select('id,title,priority,due_at').neq('status', 'done').order('due_at', { ascending: true, nullsFirst: false }).limit(5),
      supabase.from('invoices_cache').select('id,name,partner_name,amount_residual,currency,due_date').lt('due_date', today).gt('amount_residual', 0).neq('payment_state', 'paid').order('due_date').limit(50),
    ]);
    setMails((m.data ?? []) as MailRow[]); setUnread(c.count ?? 0);
    setAppts((a.data ?? []) as Appt[]); setTasks((t.data ?? []) as Task[]); setBills((b.data ?? []) as Invoice[]);
    setReady(true); setPulse(p => p + 1);
  }, []);

  useEffect(() => {
    void load();
    const ch = supabase.channel(`livefeed-${Math.random().toString(36).slice(2)}`);
    for (const table of ['mail_messages', 'appointments', 'tasks', 'invoices_cache']) ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => void load());
    ch.subscribe();
    const onFocus = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onFocus);
    const id = setInterval(() => void load(), 120_000);
    return () => { void supabase.removeChannel(ch); document.removeEventListener('visibilitychange', onFocus); clearInterval(id); };
  }, [load]);

  async function done(task: Task) {
    setTasks(l => l.filter(x => x.id !== task.id));
    const { error } = await supabase.from('tasks').update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', task.id);
    if (error) void load();
  }

  const todayAppts = appts.filter(a => new Date(a.start_at).toDateString() === new Date(now).toDateString()).length;
  const urgent = tasks.filter(t => t.due_at && new Date(t.due_at).getTime() < now + 86_400_000).length;
  const owed = bills.reduce((s, b) => s + Number(b.amount_residual || 0), 0);
  const show = (k: Tab) => tab === 'all' || tab === k;
  const tabs: { k: Tab; label: string }[] = [{ k: 'all', label: 'Tout' }, { k: 'mail', label: 'Mails' }, { k: 'cal', label: 'RDV' }, { k: 'task', label: 'Tâches' }, { k: 'bill', label: 'Factures' }];

  return <section className="ck-card ck-live" aria-label="Flux opérationnel en direct">
    <header className="lf-head">
      <h2>Flux en direct</h2>
      <span className="lf-sync" key={pulse}><span className="lf-dot" />{ready ? 'Synchronisé' : 'Connexion…'}</span>
    </header>
    <p className="lf-flash">
      <span className="t-mail">{unread} nouveau{unread > 1 ? 'x' : ''} mail{unread > 1 ? 's' : ''}</span>
      <span className="t-cal">{todayAppts} RDV aujourd’hui</span>
      <span className="t-task">{urgent} tâche{urgent > 1 ? 's' : ''} urgente{urgent > 1 ? 's' : ''}</span>
      <span className="t-bill">{bills.length} facture{bills.length > 1 ? 's' : ''} échue{bills.length > 1 ? 's' : ''}{owed ? ` (${money(owed, bills[0]?.currency)})` : ''}</span>
    </p>
    <div className="lf-tabs" role="tablist">{tabs.map(x => <button key={x.k} role="tab" aria-selected={tab === x.k} className={tab === x.k ? 'on' : ''} onClick={() => setTab(x.k)}>{x.label}</button>)}</div>

    <div className={`lf-grid ${tab === 'all' ? '' : 'single'}`}>
      {show('mail') && <div className="lf-col t-mail">
        <Link to="/mail" className="lf-title"><Mail /><b>Sendy</b>{unread > 0 && <span className="lf-badge">{unread}</span>}<ChevronRight className="lf-go" /></Link>
        {mails.length ? mails.map(m => <Link key={m.id} to="/mail" className="lf-item"><span className="lf-main"><b>{m.from_name || m.from_address || 'Expéditeur'}</b><small>{m.subject || '(sans objet)'}</small></span><em>{ago(m.created_at, now)}</em></Link>) : <p className="lf-empty">Boîte de réception à jour.</p>}
      </div>}

      {show('cal') && <div className="lf-col t-cal">
        <Link to="/calendsky/planning" className="lf-title"><CalendarDays /><b>Calendsky</b><ChevronRight className="lf-go" /></Link>
        {appts.length ? appts.map((a, i) => <Link key={a.id} to="/calendsky/planning" className={`lf-item ${i === 0 ? 'lf-next' : ''}`}><span className="lf-main"><b>{a.title}</b><small>{time(a.start_at)}{a.client ? ` · ${a.client}` : ''}{a.location ? ` · ${a.location}` : ''}</small></span><em>{until(a.start_at, now)}</em></Link>) : <p className="lf-empty">Aucun rendez-vous à venir.</p>}
      </div>}

      {show('task') && <div className="lf-col t-task">
        <Link to="/tasks" className="lf-title"><ListChecks /><b>Skytask</b><ChevronRight className="lf-go" /></Link>
        {tasks.length ? tasks.map(t => <div key={t.id} className="lf-item"><button className="lf-check" aria-label={`Terminer ${t.title}`} onClick={() => void done(t)}><Check /></button><span className="lf-main"><b>{t.title}</b><small><span className={`lf-prio p-${t.priority}`}>{prioLabel[t.priority] ?? t.priority}</span>{t.due_at ? ` · ${new Date(t.due_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` : ''}</small></span></div>) : <p className="lf-empty">Toutes les tâches sont faites.</p>}
      </div>}

      {show('bill') && <div className="lf-col t-bill">
        <Link to="/factures" className="lf-title"><ReceiptEuro /><b>Angelo</b>{owed > 0 && <span className="lf-badge">{money(owed, bills[0]?.currency)}</span>}<ChevronRight className="lf-go" /></Link>
        {bills.length ? bills.slice(0, 4).map(b => <Link key={b.id} to="/factures" className="lf-item"><span className="lf-main"><b>{b.partner_name || b.name}</b><small>{b.name} · {b.due_date ? `${lateDays(b.due_date)} j de retard` : 'échue'}</small></span><em className="lf-amount">{money(Number(b.amount_residual), b.currency)}</em></Link>) : <p className="lf-empty">Aucune facture échue.</p>}
      </div>}
    </div>
  </section>;
}

type Event = { id: string; at: string; kind: 'team' | 'auto' | 'lab'; title: string; detail: string; live: boolean };
const labKinds: Record<string, string> = { app_open: 'Application ouverte', idea_created: 'Nouvelle idée', automation: 'Automatisation' };

/** Live journal of agents (Smart Teams), automations (MyMackenzy) and lab activity. */
export function AgentsLive() {
  const now = useNow();
  const [events, setEvents] = useState<Event[]>([]);
  const [saved, setSaved] = useState(0);

  const load = useCallback(async () => {
    const week = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const [st, ex, au, la] = await Promise.all([
      supabase.from('st_tasks').select('id,title,status,updated_at').order('updated_at', { ascending: false }).limit(8),
      supabase.from('executions').select('id,status,started_at,automation_id').order('started_at', { ascending: false }).limit(8),
      supabase.from('automations').select('id,name'),
      supabase.from('lab_activity').select('id,kind,app_key,seconds_saved,created_at').gte('created_at', week).order('created_at', { ascending: false }).limit(40),
    ]);
    const names = new Map((au.data ?? []).map(a => [a.id, a.name]));
    const list: Event[] = [
      ...(st.data ?? []).map(t => ({ id: `st${t.id}`, at: t.updated_at, kind: 'team' as const, title: t.title, detail: t.status === 'done' ? 'Mission terminée · Smart Teams' : t.status === 'running' || t.status === 'in_progress' ? 'Agent au travail · Smart Teams' : `${t.status} · Smart Teams`, live: t.status === 'running' || t.status === 'in_progress' })),
      ...(ex.data ?? []).map(e => ({ id: `ex${e.id}`, at: e.started_at, kind: 'auto' as const, title: names.get(e.automation_id) ?? 'Automatisation', detail: `${e.status === 'running' ? 'En cours' : e.status === 'success' ? 'Réussie' : e.status === 'error' ? 'Échec' : e.status === 'pending' ? 'En attente' : e.status} · MyMackenzy`, live: e.status === 'running' })),
      ...(la.data ?? []).slice(0, 8).map(l => ({ id: `la${l.id}`, at: l.created_at, kind: 'lab' as const, title: labKinds[l.kind] ?? l.kind, detail: l.app_key ? `${l.app_key} · Laboratoire` : 'Laboratoire', live: false })),
    ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 9);
    setEvents(list);
    setSaved((la.data ?? []).reduce((s, l) => s + l.seconds_saved, 0));
  }, []);

  useEffect(() => {
    void load();
    const ch = supabase.channel(`agentslive-${Math.random().toString(36).slice(2)}`);
    for (const table of ['st_tasks', 'executions', 'lab_activity']) ch.on('postgres_changes', { event: '*', schema: 'public', table }, () => void load());
    ch.subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [load]);

  const active = events.filter(e => e.live).length;
  const Icon = { team: Users, auto: Workflow, lab: Sparkles };
  return <section className="ck-card ck-agents" aria-label="Activité des agents en direct">
    <header className="lf-head"><h3><Bot size={15} />Agents en direct</h3><span className={`lf-sync ${active ? 'busy' : ''}`}><span className="lf-dot" />{active ? `${active} au travail` : 'En veille'}</span></header>
    <p className="ag-saved">Temps gagné (7 j) <b>{Math.floor(saved / 3600)} h {String(Math.round((saved % 3600) / 60)).padStart(2, '0')}</b></p>
    <ol className="ag-list">
      {events.length ? events.map(e => { const I = Icon[e.kind]; return <li key={e.id} className={`ag-item k-${e.kind} ${e.live ? 'live' : ''}`}><span className="ag-ico"><I /></span><span className="lf-main"><b>{e.title}</b><small>{e.detail}</small></span><em>{ago(e.at, now)}</em></li>; }) : <p className="lf-empty">Aucune activité récente. Confiez une mission à vos agents.</p>}
    </ol>
    <Link to="/board" className="ck-link">Ouvrir Smart Teams <ChevronRight size={12} /></Link>
  </section>;
}
