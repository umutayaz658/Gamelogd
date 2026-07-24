FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

COPY requirements.txt .
# Plain install, no BuildKit cache mount — Railway's build pipeline rejected the
# --mount=type=cache syntax twice (missing id, then a Railway-specific cacheKey prefix
# requirement) and failed the production build both times. Not worth chasing a builder-
# specific cache flag; a slower rebuild on requirements.txt changes is a fine trade-off
# for a Dockerfile that just works everywhere.
RUN pip install --no-cache-dir -r requirements.txt

# Bake the post-classification embedding model into the image at build time — without
# this it downloads ~470MB from Hugging Face on the *first* post created after every
# container start/recreate, which blocks that request well past any reasonable client
# timeout (see api/services/embeddings.py).
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')"

COPY . .

CMD python manage.py migrate --noinput && python manage.py collectstatic --noinput && daphne -b 0.0.0.0 -p $PORT config.asgi:application
