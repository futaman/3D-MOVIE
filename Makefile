# 開発用ショートカット(WSL2 の Ubuntu から実行)
.PHONY: setup schema test test-api test-worker web-dev api-dev worker-dev up down logs lint

VENV=.venv/bin

setup:            ## Python 仮想環境と Web 依存を入れる
	uv venv .venv
	$(VENV)/uv pip install -e packages/schema -e "services/api[dev]" -e "services/worker[dev]" || \
	  uv pip install --python $(VENV)/python -e packages/schema -e "services/api[dev]" -e "services/worker[dev]"
	cd apps/web && npm install --no-audit --no-fund
	cp -n .env.example .env || true

schema:           ## Pydantic → JSON Schema → TS 型 を再生成
	$(VENV)/python packages/schema/export_json_schema.py
	cd apps/web && npm run -s gen:schema

test: test-api test-worker

test-api:
	cd services/api && ../../$(VENV)/python -m pytest -q

test-worker:
	cd services/worker && ../../$(VENV)/python -m pytest -q

lint:
	$(VENV)/ruff check services packages
	cd apps/web && npx tsc --noEmit

api-dev:          ## API をローカル(sqlite + inline キュー)で起動。GPU/Docker 不要
	cd services/api && DATABASE_URL=sqlite:///./dev.sqlite3 QUEUE_BACKEND=inline DATA_DIR=../../data \
	  ../../$(VENV)/uvicorn movie_api.main:app --reload --port 8000

web-dev:
	cd apps/web && npm run dev

up:               ## 全サービスを Docker で起動(GPU 必要)
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f --tail=100
