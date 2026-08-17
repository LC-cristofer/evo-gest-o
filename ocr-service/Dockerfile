FROM python:3.11-slim

# Retry em caso de falha de rede (comum em Windows com VPN)
RUN for i in 1 2 3; do \
      apt-get update -y && \
      apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-por && \
      break || sleep 10; \
    done && \
    rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir flask==3.0.3 pytesseract==0.3.10 Pillow==10.3.0

WORKDIR /app
COPY main.py .

EXPOSE 5001
CMD ["python", "main.py"]
