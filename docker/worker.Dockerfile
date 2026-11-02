# GPU ワーカー。CUDA 12.4 ランタイム + Python 3.11 + Blender + ffmpeg。
# 実モデル(Hunyuan3D, UniRig 等)の依存はフェーズ 0 で requirements-gpu.txt に固定して追加する。
FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04
ENV DEBIAN_FRONTEND=noninteractive PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
      python3.11 python3.11-venv python3-pip git curl xz-utils ffmpeg \
      libgl1 libglib2.0-0 libxi6 libxrender1 libxkbcommon0 libsm6 libxext6 libxfixes3 libxxf86vm1 \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3.11 /usr/bin/python && python -m pip install --upgrade pip uv

# Blender(ヘッドレス)。ARG で版を差し替え可能
ARG BLENDER_VERSION=4.2.3
ARG BLENDER_SERIES=4.2
RUN curl -fsSL "https://download.blender.org/release/Blender${BLENDER_SERIES}/blender-${BLENDER_VERSION}-linux-x64.tar.xz" \
      -o /tmp/blender.tar.xz \
    && mkdir -p /opt/blender && tar -xJf /tmp/blender.tar.xz -C /opt/blender --strip-components=1 \
    && rm /tmp/blender.tar.xz && ln -s /opt/blender/blender /usr/local/bin/blender

WORKDIR /app
COPY packages/schema packages/schema
COPY services/api services/api
COPY services/worker services/worker
# torch は CUDA 12.4 ホイール。dummy プロバイダだけなら不要だが、フェーズ 0 の実測で必ず使う
RUN uv pip install --system torch==2.4.1 --index-url https://download.pytorch.org/whl/cu124 \
    && uv pip install --system -e packages/schema -e services/api -e services/worker
# 実モデル依存(フェーズ 0 で有効化): COPY services/worker/requirements-gpu.txt . && uv pip install --system -r requirements-gpu.txt

ENV BLENDER_BIN=/usr/local/bin/blender FFMPEG_BIN=/usr/bin/ffmpeg
WORKDIR /app/services/worker
CMD ["python", "-m", "movie_worker.main"]
