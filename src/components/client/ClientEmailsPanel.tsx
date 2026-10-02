import { useEffect, useState } from 'react';
import { Mail, Send } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Client, Project } from '../../types';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface EmailTemplate { id: string; template_key: string; name: string; subject_template: string; body_template: string }
interface EmailLog { id: string; recipient: string; subject: string; status: string; created_at: string }

export function ClientEmailsPanel({ client, projects }: { client: Client; projects: Project[] }) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templateKey, setTemplateKey] = useState('client_onboarding');
  const [projectId, setProjectId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [logs, setLogs] = useState<EmailLog[]>([]);

  useEffect(() => {
    void supabase.from('email_templates').select('id, template_key, name, subject_template, body_template').order('name').then(({ data }) => {
      const loaded = (data || []) as EmailTemplate[];
      setTemplates(loaded);
      const selected = loaded.find((item) => item.template_key === 'client_onboarding') || loaded[0];
      if (selected) { setTemplateKey(selected.template_key); setSubject(selected.subject_template); setBody(selected.body_template); }
    });
  }, []);

  async function refreshLogs() {
    const { data } = await supabase.from('client_email_log').select('id, recipient, subject, status, created_at').eq('client_id', client.id).order('created_at', { ascending: false });
    setLogs((data || []) as EmailLog[]);
  }

  useEffect(() => {
    void supabase.from('client_email_log').select('id, recipient, subject, status, created_at').eq('client_id', client.id).order('created_at', { ascending: false }).then(({ data }) => setLogs((data || []) as EmailLog[]));
  }, [client.id]);

  function selectTemplate(nextKey: string) {
    setTemplateKey(nextKey);
    const selected = templates.find((item) => item.template_key === nextKey);
    if (selected) { setSubject(selected.subject_template); setBody(selected.body_template); }
  }

  async function send() {
    if (!client.email) { setMessage('Add a client email address before sending.'); return; }
    setSending(true); setMessage('');
    const { data, error } = await supabase.functions.invoke('send-client-email', { body: { client_id: client.id, project_id: projectId || null, template_key: templateKey, subject_override: subject, body_override: body } });
    setMessage(error ? error.message : data?.message || 'Email sent.');
    if (!error) await refreshLogs();
    setSending(false);
  }

  return <div className="space-y-4"><Card><div className="flex items-center gap-2 mb-4"><Mail size={18} /><h2 className="font-bold">Email client</h2></div><p className="text-sm text-gray-500 mb-4">Recipient is locked to {client.email || 'the client record'}. Placeholders and financial context are resolved server-side.</p><div className="grid md:grid-cols-2 gap-4"><div><label className="text-sm font-medium">Template</label><select value={templateKey} onChange={(event) => selectTemplate(event.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">{templates.map((item) => <option key={item.id} value={item.template_key}>{item.name}</option>)}</select></div><div><label className="text-sm font-medium">Project context</label><select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"><option value="">Client only</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div></div><label className="block text-sm font-medium mt-4">Subject</label><input value={subject} onChange={(event) => setSubject(event.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /><label className="block text-sm font-medium mt-4">Message</label><textarea value={body} onChange={(event) => setBody(event.target.value)} rows={10} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" /><div className="mt-4 rounded-lg bg-gray-50 border p-4"><p className="text-xs uppercase font-semibold text-gray-400">Preview</p><p className="font-semibold mt-2">{subject}</p><p className="text-sm whitespace-pre-wrap mt-2 text-gray-600">{body}</p></div><div className="flex items-center gap-3 mt-4"><Button onClick={send} loading={sending} disabled={!client.email || templates.length === 0}><Send size={15} /> Send email</Button>{message && <p className="text-sm text-gray-600">{message}</p>}</div></Card><Card padding={false}><div className="px-5 py-4 border-b"><h3 className="font-bold">Email history</h3></div>{logs.length === 0 ? <p className="p-6 text-sm text-gray-400">No stored email events.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-gray-50"><th className="p-3 text-left">Subject</th><th className="p-3 text-left">Recipient</th><th className="p-3 text-left">Status</th><th className="p-3 text-left">Date</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id} className="border-t"><td className="p-3">{log.subject}</td><td className="p-3">{log.recipient}</td><td className="p-3 capitalize">{log.status}</td><td className="p-3">{new Date(log.created_at).toLocaleDateString('en-IN')}</td></tr>)}</tbody></table></div>}</Card></div>;
}
