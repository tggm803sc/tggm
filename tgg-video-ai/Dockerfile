FROM node:22-bookworm-slim

ARG TGG_BUILD_SHA=unknown

ENV TGG_BUILD_SHA=${TGG_BUILD_SHA} \
     NODE_ENV=production \
    TGG_VIDEO_AI_HOST=0.0.0.0 \
    TGG_VIDEO_AI_PORT=10050 \
    TGG_VIDEO_AI_ROOT=/data/tgg-video-ai \
    TGG_VIDEO_AI_OUTPUT_DIR=/data/tgg-video-ai/outputs \
    TGG_VIDEO_AI_RENDER_MODE=ffmpeg

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY tgg-video-ai/ /app/tgg-video-ai/

RUN useradd --system --uid 10001 --create-home tgg \
 && mkdir -p /data/tgg-video-ai \
 && chown -R tgg:tgg /app /data/tgg-video-ai

USER tgg
EXPOSE 10050

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:10050/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node","tgg-video-ai/server.mjs"]
