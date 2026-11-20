# Viva preparation
1. **Why three paradigms?** SQL enforces structured relationships; Mongo handles heterogeneous evidence; vectors retrieve by meaning. pgvector shares the SQL server, reducing operations.
2. **Is pgvector another server?** No. It is a PostgreSQL extension adding a vector type and similarity/index operations.
3. **Where are reports stored?** Authoritative full reports are Mongo documents. SQL stores derived vector snippets and source/version references, not duplicate report tables.
4. **Why junction tables?** One incident can affect many assets and one asset can appear in many incidents. Composite PKs prevent duplicate links.
5. **What guarantees SQL integrity?** PK, FK, UNIQUE, NOT NULL, CHECK, transactions and workflow/audit trigger.
6. **Can Mongo have an SQL FK?** No. Existence/access checks are application-managed; reconciliation addresses indexing consistency.
7. **Are all database writes globally atomic?** No. PostgreSQL transactions cover SQL writes only. Report-to-index propagation is eventual and observable.
8. **Why embeddings?** Similar descriptions may share meaning without shared words. General-language embeddings are imperfect and need evaluation.
9. **What do 384 dimensions mean?** Each text becomes an ordered array of 384 learned numeric features. Individual coordinates are not human-labelled attack properties.
10. **Cosine similarity?** Measures directional similarity. pgvector <=> returns cosine distance; 1-distance is a similarity score, not confidence.
11. **Exact vs HNSW?** Exact search compares authorized vectors directly; HNSW trades exhaustive ranking for faster approximate retrieval at scale. Optional HNSW is not the default small-demo implementation.
12. **Why does PostgreSQL ignore my index?** On a small table, reading it sequentially can cost less than index traversal plus row lookup.
13. **Why version records?** Prevent lost incident/report edits and avoid returning stale derived vectors after source changes.
14. **Where are passwords?** bcrypt hashes in app_users; connection secrets in ignored environment variables. Runtime database credentials cannot simply be password-hashed because the server needs them to connect.
15. **What happens when the model is down?** Source records remain saved; indexing jobs fail visibly and can be retried. Semantic API returns a clear unavailable response; keyword search still works.
16. **What did each member implement?** Answer using real commits and tests. Fill the contribution document before presentation.
17. **Limitations?** Synthetic data, generic-language model, single-organization role model, local limiter, eventually consistent cross-store operations, limited evidence pagination, no production hardening.
18. **Future enhancements?** Token-aware chunking, cybersecurity-domain embedding evaluation, hybrid keyword/vector ranking, durable distributed queue, SSO/MFA, full evidence pagination, retention/backup policies, and tested scale-out retrieval.
