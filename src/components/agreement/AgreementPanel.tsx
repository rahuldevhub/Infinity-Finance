import { useEffect, useMemo, useState } from 'react';
import { Download, FileSignature } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { Client, Project } from '../../types';
import { COMPANY_LABELS, inheritProjectCompany } from '../../domain/company';
import { SAMPLE_AGREEMENT_TEMPLATE } from '../../domain/agreementTemplates';
import { renderTemplate } from '../../domain/templateRenderer';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { usePDFDownload } from '../../hooks/usePDFDownload';
import { useAuth } from '../../hooks/useAuth';
import { AgreementPDF } from './AgreementPDF';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface AgreementRow { id: string; project_id: string; rendered_title: string; rendered_content: string; status: string; generated_at: string }

export function AgreementPanel({ client, projects }: { client: Client; projects: Project[] }) {
  const { user } = useAuth();
  const { downloadPDF, loading: downloading } = usePDFDownload();
  const [projectId, setProjectId] = useState(projects[0]?.id || '');
  const [agreements, setAgreements] = useState<AgreementRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const project = projects.find((item) => item.id === projectId);

  useEffect(() => {
    void supabase.from('project_agreements').select('id, project_id, rendered_title, rendered_content, status, generated_at').eq('client_id', client.id).order('generated_at', { ascending: false }).then(({ data }) => setAgreements((data || []) as AgreementRow[]));
  }, [client.id]);

  const preview = useMemo(() => {
    if (!project) return null;
    const company = inheritProjectCompany(client.default_company, project.company);
    const values = {
      date: new Date().toLocaleDateString('en-IN'),
      company_name: COMPANY_LABELS[company], client_name: client.name, project_name: project.name,
      client_email: client.email || 'Not provided', client_phone: client.phone || 'Not provided',
      client_address: [client.address, client.state].filter(Boolean).join(', ') || 'Not provided',
      service_details: project.service_details || project.description || 'To be confirmed',
      proposed_price: project.proposed_price == null ? 'To be confirmed' : formatCurrency(project.proposed_price),
      contract_value: project.contract_value == null ? 'Not confirmed' : formatCurrency(project.contract_value),
    };
    return { title: renderTemplate(SAMPLE_AGREEMENT_TEMPLATE.title, values), content: renderTemplate(SAMPLE_AGREEMENT_TEMPLATE.body, values) };
  }, [client, project]);

  async function generate() {
    if (!project || !preview) return;
    setSaving(true); setMessage('');
    const renderedContent = editedContent || preview.content;
    const { data, error } = await supabase.from('project_agreements').insert({ client_id: client.id, project_id: project.id, template_key: SAMPLE_AGREEMENT_TEMPLATE.key, template_name: SAMPLE_AGREEMENT_TEMPLATE.name, rendered_title: preview.title, rendered_content: renderedContent, generated_by: user?.id || null }).select('id, project_id, rendered_title, rendered_content, status, generated_at').single();
    if (error) setMessage(error.message); else { setAgreements((rows) => [data as AgreementRow, ...rows]); setMessage('Agreement snapshot generated.'); }
    setSaving(false);
  }

  return <div className="space-y-4">
    <Card><div className="flex flex-wrap items-end gap-3"><div className="flex-1 min-w-56"><label className="text-sm font-medium text-gray-700">Project</label><select value={projectId} onChange={(event) => { setProjectId(event.target.value); setEditedContent(''); setEditing(false); }} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"><option value="">Select project</option>{projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><p className="mt-2 text-xs font-semibold text-amber-700">Publishing Agreement · Status: Draft Ready · Sample Template</p></div><Button variant="outline" disabled={!preview} onClick={() => { if (preview && !editedContent) setEditedContent(preview.content); setEditing((value) => !value); }}>{editing ? 'Preview' : 'Edit'}</Button><Button onClick={generate} disabled={!preview} loading={saving}><FileSignature size={15} /> Generate PDF record</Button>{preview && <Button variant="outline" loading={downloading} onClick={() => downloadPDF(<AgreementPDF title={preview.title} content={editedContent || preview.content} />, `${project?.name || 'agreement'}-preview.pdf`)}><Download size={15} /> Download PDF</Button>}</div>{message && <p className="mt-3 text-sm text-gray-600">{message}</p>}</Card>
    {preview && <Card><h3 className="font-bold text-lg">{preview.title}</h3>{editing ? <textarea value={editedContent} onChange={(event) => setEditedContent(event.target.value)} rows={22} className="mt-4 w-full border rounded-lg p-3 text-sm leading-7" /> : <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-gray-700">{editedContent || preview.content}</p>}</Card>}
    <Card padding={false}><div className="px-5 py-4 border-b"><h3 className="font-bold">Generated agreements</h3></div>{agreements.length === 0 ? <p className="p-6 text-sm text-gray-400">No generated agreement snapshots.</p> : <div className="divide-y">{agreements.map((item) => <div key={item.id} className="px-5 py-3 flex items-center justify-between"><div><p className="font-semibold text-sm">{item.rendered_title}</p><p className="text-xs text-gray-400">{formatDate(item.generated_at)} · {item.status}</p></div><Button size="sm" variant="ghost" onClick={() => downloadPDF(<AgreementPDF title={item.rendered_title} content={item.rendered_content} />, `${item.rendered_title}.pdf`)}><Download size={14} /></Button></div>)}</div>}</Card>
  </div>;
}
