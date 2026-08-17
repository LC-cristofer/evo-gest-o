"""
OCR Service — C.A.S.C.A
Extrai dados de documentos (RG, CPF, etc.) via Tesseract
Roda como microserviço HTTP na porta 5001
"""
import os
import re
import json
import base64
import tempfile
from pathlib import Path

try:
    from flask import Flask, request, jsonify
    import pytesseract
    from PIL import Image
    import io
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False

app = Flask(__name__) if OCR_AVAILABLE else None

def clean(text):
    return re.sub(r'\s+', ' ', text).strip()

def extract_cpf(text):
    matches = re.findall(r'\d{3}[\.\s]?\d{3}[\.\s]?\d{3}[\.\s\-]?\d{2}', text)
    for m in matches:
        digits = re.sub(r'\D', '', m)
        if len(digits) == 11:
            return f"{digits[:3]}.{digits[3:6]}.{digits[6:9]}-{digits[9:]}"
    return None

def extract_rg(text):
    patterns = [
        r'RG[:\s]+([0-9X\.\-]+)',
        r'Identidade[:\s]+([0-9X\.\-]+)',
        r'\b\d{1,2}[\.\s]\d{3}[\.\s]\d{3}[\-\s]?\d{1}',
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            return m.group(1) if '(' in m.pattern else m.group(0)
    return None

def extract_name(text):
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    for line in lines:
        words = line.split()
        if 3 <= len(words) <= 6 and all(w[0].isupper() or w[0].isdigit() == False for w in words if w):
            if not any(kw in line.upper() for kw in ['REPÚBLICA','ESTADO','SECRETARIA','VALIDADE','REGISTRO','DIGITAL']):
                return line
    return None

def extract_birth_date(text):
    patterns = [
        r'Nasc\w*[:\s]+(\d{2}[/\-\.]\d{2}[/\-\.]\d{4})',
        r'(\d{2}[/\-]\d{2}[/\-]\d{4})',
        r'(\d{4}[/\-]\d{2}[/\-]\d{2})',
    ]
    for p in patterns:
        m = re.search(p, text, re.IGNORECASE)
        if m:
            date_str = m.group(1)
            parts = re.split(r'[/\-\.]', date_str)
            if len(parts) == 3:
                if len(parts[0]) == 4:
                    return f"{parts[0]}-{parts[1].zfill(2)}-{parts[2].zfill(2)}"
                else:
                    return f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
    return None

def process_image(image_bytes):
    img = Image.open(io.BytesIO(image_bytes))
    # Pré-processamento: converter para escala de cinza
    img = img.convert('L')
    # Aumentar contraste se necessário
    config = '--oem 3 --psm 3 -l por+eng'
    text = pytesseract.image_to_string(img, config=config)
    return text

if OCR_AVAILABLE:
    @app.route('/health', methods=['GET'])
    def health():
        return jsonify({'status': 'ok', 'ocr': OCR_AVAILABLE})

    @app.route('/extract', methods=['POST'])
    def extract():
        try:
            data = request.get_json()
            if not data:
                return jsonify({'error': 'JSON body required'}), 400

            image_b64 = data.get('image_base64')
            doc_type  = data.get('doc_type', 'auto')

            if not image_b64:
                return jsonify({'error': 'image_base64 required'}), 400

            image_bytes = base64.b64decode(image_b64)
            text = process_image(image_bytes)

            result = {
                'raw_text': text,
                'doc_type': doc_type,
                'extracted': {}
            }

            result['extracted']['cpf']        = extract_cpf(text)
            result['extracted']['rg']         = extract_rg(text)
            result['extracted']['full_name']  = extract_name(text)
            result['extracted']['birth_date'] = extract_birth_date(text)

            # Remove Nones
            result['extracted'] = {k: v for k, v in result['extracted'].items() if v}

            return jsonify(result)

        except Exception as e:
            return jsonify({'error': str(e)}), 500

    if __name__ == '__main__':
        port = int(os.environ.get('PORT', 5001))
        print(f"[OCR] Serviço rodando na porta {port}")
        app.run(host='0.0.0.0', port=port, debug=False)
else:
    # Fallback sem Flask — responde via HTTP simples
    import http.server
    import socketserver

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path == '/health':
                body = b'{"status":"degraded","ocr":false,"message":"Flask/pytesseract not installed"}'
                self.send_response(200)
                self.send_header('Content-Type','application/json')
                self.end_headers()
                self.wfile.write(body)
        def log_message(self, *_): pass

    print("[OCR] Flask não disponível. Subindo servidor de fallback.")
    with socketserver.TCPServer(('0.0.0.0', 5001), Handler) as httpd:
        httpd.serve_forever()
