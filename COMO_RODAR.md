# Como Rodar — C.A.S.C.A Sistema

## Primeira vez (ou após reset)

```bash
docker compose down -v
docker compose up --build
```

## Rodar sem o OCR (recomendado se tiver problema de rede)

```bash
docker compose up --build
```

O OCR (reconhecimento de documento) é **opcional** e não afeta o funcionamento do sistema.

## Rodar COM OCR (preenchimento automático via documento)

```bash
docker compose --profile ocr up --build
```

> ⚠️ O OCR precisa baixar pacotes do Tesseract (~200MB). Se der erro de rede,
> use sem o perfil `ocr` — tudo funciona normalmente.

## URLs após subir

| Serviço  | URL                          |
|----------|------------------------------|
| Sistema  | http://localhost:3000        |
| API      | http://localhost:4000        |
| Health   | http://localhost:4000/health |
| E-mails  | http://localhost:8025        |

## Logins

| Email                   | Senha      | Perfil    |
|-------------------------|------------|-----------|
| ti@casca.org.br         | Admin@123  | TI        |
| rh@casca.org.br         | Admin@123  | RH        |
| ti@ong.org.br           | Admin@123  | TI        |
| rh@ong.org.br           | Admin@123  | RH        |
| noemi@casca.org.br      | Admin@123  | Supervisor|

## Se o login der 401

O banco tem usuários com hash inválido. Solução:

```bash
docker compose down -v   # apaga volume do banco
docker compose up --build
```

## Logs

```bash
docker compose logs api       # logs da API
docker compose logs frontend  # logs do frontend
docker compose logs -f api    # em tempo real
```
