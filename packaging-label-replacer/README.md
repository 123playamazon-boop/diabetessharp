# Rótulo automático na embalagem

Uma página: envias a **foto da embalagem** e recebes um **PNG** com o rótulo aplicado.

O rótulo oficial está em **`static/labels/official-label.png`**. Se for RGB com fundo preto, o sistema trata o preto como transparente ao colar.

## Como correr

```bash
cd packaging-label-replacer
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8765
```
o que eu fazer agora
Abre `http://127.0.0.1:8765`

## Como funciona

1. O servidor tenta **detetar** na foto uma região de rótulo (claro ou colorido).
2. Se não encontrar, usa um **retângulo ao centro** da imagem.
3. Tenta **apagar o rótulo claro da loja** na zona da tampa (papel branco) com inpainting, depois aplica **perspectiva** e acabamento em `app/`.
