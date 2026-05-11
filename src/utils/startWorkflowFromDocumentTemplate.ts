import { documentsApi } from '@/api/documents';
import { workflowApi } from '@/api/workflow';
import { getErrorMessage } from '@/api/client';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type StartWorkflowFromDocumentTemplateResult = {
  started: boolean;
  skippedNoWorkflowOnTemplate: boolean;
  skippedAlreadyExists: boolean;
  error?: string;
};

/**
 * After a document is submitted for review: if its catalogue template assigns a workflow,
 * start that workflow once (no-op if an instance already exists for the document).
 */
export async function startWorkflowFromDocumentTemplate(
  documentId: string,
  documentCatalogueTemplateId: string | null | undefined
): Promise<StartWorkflowFromDocumentTemplateResult> {
  const tplId = documentCatalogueTemplateId?.trim();
  if (!tplId || !UUID_REGEX.test(tplId)) {
    return {
      started: false,
      skippedNoWorkflowOnTemplate: true,
      skippedAlreadyExists: false,
    };
  }

  const existing = await workflowApi.getInstanceByDocumentId(documentId);
  if (existing) {
    return {
      started: false,
      skippedNoWorkflowOnTemplate: false,
      skippedAlreadyExists: true,
    };
  }

  let catalogueTpl;
  try {
    catalogueTpl = await documentsApi.getTemplate(tplId);
  } catch (e) {
    return {
      started: false,
      skippedNoWorkflowOnTemplate: false,
      skippedAlreadyExists: false,
      error: getErrorMessage(e),
    };
  }

  const wfTplId = catalogueTpl.metadata?.workflow_template_id?.trim();
  if (!wfTplId || !UUID_REGEX.test(wfTplId)) {
    return {
      started: false,
      skippedNoWorkflowOnTemplate: true,
      skippedAlreadyExists: false,
    };
  }

  try {
    await workflowApi.start({ template_id: wfTplId, document_id: documentId });
    return {
      started: true,
      skippedNoWorkflowOnTemplate: false,
      skippedAlreadyExists: false,
    };
  } catch (e) {
    return {
      started: false,
      skippedNoWorkflowOnTemplate: false,
      skippedAlreadyExists: false,
      error: getErrorMessage(e),
    };
  }
}
