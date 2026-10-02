import { supabase } from '../lib/supabase';

export type ClientFinancialDocumentType = 'invoice' | 'receipt' | 'quotation' | 'proforma';

export async function deleteClientFinancialDocument(
  type: ClientFinancialDocumentType,
  id: string,
  workspace: string,
): Promise<void> {
  const { error } = await supabase.rpc('delete_client_financial_document', {
    p_document_type: type,
    p_document_id: id,
    p_workspace: workspace,
  });
  if (error) throw error;
}

export async function deleteClientProject(projectId: string, workspace: string): Promise<void> {
  const { error } = await supabase.rpc('delete_client_project', {
    p_project_id: projectId,
    p_workspace: workspace,
  });
  if (error) throw error;
}

export async function deleteClientRecord(clientId: string, workspace: string): Promise<void> {
  const { error } = await supabase.rpc('delete_client_record', {
    p_client_id: clientId,
    p_workspace: workspace,
  });
  if (error) throw error;
}
