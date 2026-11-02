FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
RUN pip install uv
WORKDIR /app
COPY packages/schema packages/schema
COPY services/api services/api
RUN uv pip install --system -e packages/schema -e services/api
WORKDIR /app/services/api
EXPOSE 8000
CMD ["uvicorn", "movie_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
