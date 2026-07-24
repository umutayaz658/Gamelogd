# syntax=docker/dockerfile:1.4
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

COPY requirements.txt .
# BuildKit cache mount (not --no-cache-dir) — this repo's requirements.txt now pulls in
# torch/CUDA/transformers (multiple GB). Without a persistent pip cache, any one-line
# requirements.txt edit forces a full re-download from PyPI on every rebuild, which is slow
# and (observed twice in this environment) large enough to destabilize Docker Desktop during
# the final image-export step.
RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt

# Bake the post-classification embedding model into the image at build time — without
# this it downloads ~470MB from Hugging Face on the *first* post created after every
# container start/recreate, which blocks that request well past any reasonable client
# timeout (see api/services/embeddings.py).
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')"

COPY . .

CMD python manage.py migrate --noinput && python manage.py collectstatic --noinput && daphne -b 0.0.0.0 -p $PORT config.asgi:application
