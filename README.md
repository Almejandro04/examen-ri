# Recuperación de información en NFCorpus

La API permite buscar en 3.633 documentos con BM25 y TF-IDF.

- [Notebook ejecutado](Examen_RI.ipynb)
- [Servicio web público](https://examen-ri-servicio.vercel.app/)
- [Disponibilidad del servicio](https://examen-ri-servicio.vercel.app/health) (`GET /health`)

La búsqueda se envía a `POST /search` con `Content-Type: application/json`.

```json
{"query":"DHA","model":"bm25","top_k":10}
```

El campo `model` admite `bm25` y `tfidf`.
