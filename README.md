# Document Management API

A REST API for managing documents with find/replace operations, full-text search, and version control.

## Setup

```bash
npm install
npm run dev:all
```

This starts the backend on port 3000 and the frontend at http://localhost:5174/. Both reload automatically when you change files.


### Testing

124 tests across unit, integration, and performance.

- **Unit** - Storage service, change service, search service, ETag utilities
- **Integration** - Document CRUD, find/replace, search, concurrency conflicts, error responses
- **Performance** - Large document handling (10MB), bulk operations, sequential changes

```bash
npm test             # Run all tests
npm run test:watch   # Watch mode
npm run test:coverage # With coverage report
```

## Usage Examples

### Create a Document

```bash
curl -X POST http://localhost:3000/api/documents \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Meeting Notes",
    "content": "Discussed project timeline and budget.",
    "author": "Jane",
    "tags": ["meetings", "2024"]
  }'
```

### Get a Document

```bash
curl http://localhost:3000/api/documents/{id}
```

The response includes an `ETag` header. Save it if you plan to update the document.

### Update a Document

```bash
curl -X PATCH http://localhost:3000/api/documents/{id} \
  -H "Content-Type: application/json" \
  -H "If-Match: \"v1-abc12345\"" \
  -d '{"title": "Updated Title"}'
```

The `If-Match` header prevents overwriting changes made by others. If the document changed since you fetched it, you get a 412 error.

### Find and Replace

```bash
curl -X POST http://localhost:3000/api/documents/{id}/changes \
  -H "Content-Type: application/json" \
  -d '{
    "changes": [
      {
        "searchText": "old text",
        "replaceText": "new text",
        "matchCase": true
      }
    ]
  }'
```

Options:
- `matchCase` - Case-sensitive matching (default: true)
- `matchWholeWord` - Match whole words only (default: false)
- `replaceAll` - Replace all occurrences (default: true)
- `occurrence` - Replace only the Nth occurrence (1-indexed)
- `startIndex` / `endIndex` - Replace within a character range

### Search

```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "budget",
    "contextSize": 50
  }'
```

Returns matching text with surrounding context.

### List Documents

```bash
curl "http://localhost:3000/api/documents?page=1&limit=20&sortBy=updatedAt"
```

## Performance

### How It Works

Documents are stored in memory with an inverted word index. When you search for "budget timeline", the index quickly finds which documents contain both words. Only those documents get scanned.

For find/replace:
- Simple replacements use a single regex pass
- Advanced targeting (specific occurrences, ranges) uses a two-pass approach

### Benchmarks

Tested on a MacBook Pro:
- Create 10MB document: ~300ms
- Find/replace on 10MB: ~400ms
- Search 10MB document: ~150ms
- Search across 100 documents: ~80ms

### Limits

This version stores everything in memory. It works well for development and small deployments. For production with many documents or high traffic, you'd want to add PostgreSQL for storage and Redis for caching. See `PRODUCTION_ROADMAP.md` for details.

## API Design

### Why ETags?

Multiple people might edit the same document. ETags prevent the "lost update" problem. When you fetch a document, you get its ETag. When you update it, you send that ETag back. If someone else changed the document in between, the server rejects your update with a 412 error. You fetch the new version and try again.

### Why POST for Search?

Search requests can include arrays of document IDs to filter, case sensitivity flags, and other options. Query strings get messy with complex parameters. POST with a JSON body keeps it clean.

### Why Separate Routes for Changes?

Find/replace is different from a simple document update. It can affect multiple locations, needs detailed results (how many replacements), and supports advanced targeting options. A dedicated endpoint keeps the document update logic simple.

### Error Responses

All errors follow the same format:

```json
{
  "error": "Description of what went wrong",
  "code": 400
}
```

Common codes:
- 400 - Bad request (validation failed)
- 404 - Document not found
- 412 - ETag mismatch (document was modified)

## API Documentation

Visit `http://localhost:3000/docs` for interactive Swagger documentation.
