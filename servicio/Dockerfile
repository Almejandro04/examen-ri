FROM node:22-alpine
WORKDIR /app
COPY motor.mjs api.mjs servidor.mjs indice.json.gz ./
ENV HOST=0.0.0.0 PORT=7860
EXPOSE 7860
USER node
CMD ["node", "servidor.mjs"]
