import { FastifyInstance } from 'fastify';
import { getDocument, updateDocument } from '../services/storage';
import { applyChanges } from '../services/change.service';
import { documentIdParamsSchema } from '../schemas/document.schemas';
import {
  applyChangesBodySchema,
  applyChangesResponseSchema,
  applyChangesHeadersSchema,
  preconditionFailedSchema,
} from '../schemas/change.schemas';
import { errorResponseSchema, createErrorResponse } from '../schemas/common';
import { ApplyChangesInput } from '../types/document';
import { generateETag, validateIfMatch } from '../utils/etag';

export async function changesRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Params: { id: string };
    Body: ApplyChangesInput;
    Headers: { 'if-match'?: string };
  }>('/api/documents/:id/changes', {
    schema: {
      description: `Apply redline changes (find/replace) to a document.

## Concurrency Control
Use the \`If-Match\` header with an ETag value to prevent conflicting updates.
If the document has been modified since you last fetched it, returns 412 Precondition Failed.

## Targeting Options
Each change supports multiple targeting strategies:
- **replaceAll** (default): Replace all occurrences
- **occurrence**: Replace specific occurrence by number (1-indexed)
- **startIndex/endIndex**: Replace only within character range
- **beforeContext/afterContext**: Validate surrounding text before replacing

## Examples
\`\`\`json
// Replace 2nd occurrence
{ "searchText": "foo", "replaceText": "bar", "replaceAll": false, "occurrence": 2 }

// Replace within character range (positions 100-200)
{ "searchText": "foo", "replaceText": "bar", "startIndex": 100, "endIndex": 200 }

// Contextual matching - only replace "foo" when preceded by "the "
{ "searchText": "foo", "replaceText": "bar", "beforeContext": "the " }
\`\`\``,
      tags: ['Changes'],
      params: documentIdParamsSchema,
      headers: applyChangesHeadersSchema,
      body: applyChangesBodySchema,
      response: {
        200: applyChangesResponseSchema,
        404: errorResponseSchema,
        412: preconditionFailedSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { changes } = request.body;
    const ifMatch = request.headers['if-match'];

    const doc = getDocument(id);
    if (!doc) {
      return reply.status(404).send(createErrorResponse(404, `Document with ID ${id} not found`));
    }

    if (!validateIfMatch(ifMatch, doc)) {
      const currentEtag = generateETag(doc);
      return reply.status(412).send({
        error: 'Precondition Failed: Document has been modified. Fetch the latest version and retry.',
        code: 412,
        currentEtag,
      });
    }

    const previousVersion = doc.version;

    const { newContent, results, totalReplacements } = applyChanges(doc.content, changes);

    if (totalReplacements > 0) {
      updateDocument(id, { content: newContent });
    }

    const updatedDoc = getDocument(id)!;
    const newEtag = generateETag(updatedDoc);

    return reply
      .header('ETag', newEtag)
      .send({
        document: updatedDoc,
        results,
        totalReplacements,
        previousVersion,
        newVersion: updatedDoc.version,
        etag: newEtag,
      });
  });
}
