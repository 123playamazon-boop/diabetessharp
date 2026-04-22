#!/usr/bin/env python3
"""Normaliza ortografia e vocabulário pt-PT → pt-BR só no objeto `ptBR` de catalog.ts."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "src" / "i18n" / "catalog.ts"


def transform_pt_br_line(line: str) -> str:
    s = line
    # Frases compostas primeiro
    phrases = [
        ("Saltar para o conteúdo", "Pular para o conteúdo"),
        ("Consola de operações", "Painel de operações"),
        ("Consola demo", "Painel demo"),
        ("créditos da consola", "créditos do painel"),
        ("Confirmação de pgto", "Confirmação de pagamento"),
        ("Revise morada e", "Revise o endereço e"),
        ("Actualizar extrato", "Atualizar extrato"),
        ("até à aprovação", "até a aprovação"),
        ("Sem ligação à rede", "Sem conexão com a internet"),
        ("Ficheiro da etiqueta guardado.", "Arquivo da etiqueta salvo."),
        ("Ficheiro demasiado grande", "Arquivo muito grande"),
        ("Imagem demasiado grande", "Imagem muito grande"),
        ("Ficheiro CSV gerado.", "Arquivo CSV gerado."),
        ("Ficheiro seleccionado", "Arquivo selecionado"),
        ("Seleccione um pedido", "Selecione um pedido"),
        ("exactamente estes", "exatamente estes"),
    ]
    for a, b in phrases:
        s = s.replace(a, b)

    # Palavras (ordem: mais longas / compósitos primeiro)
    words = [
        ("actualização", "atualização"),
        ("Actualização", "Atualização"),
        ("actualizado", "atualizado"),
        ("Actualizado", "Atualizado"),
        ("actualizada", "atualizada"),
        ("Actualizada", "Atualizada"),
        ("actualizados", "atualizados"),
        ("actualizadas", "atualizadas"),
        ("actualizar", "atualizar"),
        ("Actualizar", "Atualizar"),
        ("desactualizada", "desatualizada"),
        ("desactualizado", "desatualizado"),
        ("Inactivo", "Inativo"),
        ("Activo", "Ativo"),
        ("activação", "ativação"),
        ("reflecte-se", "reflete-se"),
        ("reflecte", "reflete"),
        ("seleccionado", "selecionado"),
        ("Seleccion", "Selecion"),
        ("demasiado", "muito"),
        ("Ficheiros", "Arquivos"),
        ("ficheiros", "arquivos"),
        ("Ficheiro", "Arquivo"),
        ("ficheiro", "arquivo"),
        ("guardados", "salvos"),
        ("guardado", "salvo"),
        ("guarda ", "salva "),  # "servidor guarda" → "servidor salva" raro; evitar
        ("exactos", "exatos"),
        ("exactas", "exatas"),
        ("exacto", "exato"),
        ("Exacto", "Exato"),
        ("Acções", "Ações"),
        ("acções", "ações"),
        ("Acção", "Ação"),
        ("acção", "ação"),
        ("equipa", "equipe"),
        ("Equipa", "Equipe"),
        ("planeiar", "planejar"),
    ]
    for a, b in words:
        s = s.replace(a, b)

    return s


def main() -> None:
    text = CATALOG.read_text(encoding="utf-8")
    lines = text.splitlines(keepends=True)
    # Linhas 15–1127 (1-based) = índices 14..1126 no array 0-based; linha 1128 é `};`
    start, end = 14, 1127
    for i in range(start, min(end, len(lines))):
        lines[i] = transform_pt_br_line(lines[i])

    out = "".join(lines)
    out = out.replace('"pt-BR": "PT"', '"pt-BR": "PT-BR"', 1)
    CATALOG.write_text(out, encoding="utf-8")
    print("OK:", CATALOG)


if __name__ == "__main__":
    main()
