# Metroidvania Pixel-Mask Engine

Motor de jogo 2D no estilo **Metroidvania** desenvolvido em **JavaScript puro + HTML5 Canvas**.

## Características v1.0

- **Colisão por Máscara de Pixels (Pixel-Mask):** Terreno baseado em imagem PNG com canal Alfa. Pixels opacos = sólido; pixels transparentes = ar livre.
- **Sistema de 3 Camadas por Mapa:**
  - `background_<nome>.png` → Fundo distante com efeito parallax
  - `<nome>.png` → Superfície sólida de colisão
  - `foreground_<nome>.png` → Primeiro plano (névoa, cipós, pilares) renderizado na frente de tudo
- **Física Metroidvania Completa:** Pulo variável, Coyote Time, Jump Buffering, Step-Up/Step-Down em rampas
- **Câmera Suavizada (Lerp)**
- **Concatenação de Mapas via Portais** com efeito Fade
- **Suporte a Spritesheet de Personagem**
- **Controles Touch Mobile** integrados na tela
- **Fallback procedural** quando arquivos de mapa não estão presentes

## Estrutura de Pastas

```
metroidvania/
├── index.html
├── src/
│   └── game.js
├── sprites/
│   └── player.png
└── maps/
    ├── <nome>.png
    ├── background_<nome>.png
    └── foreground_<nome>.png
```

## Como Jogar

Abra `index.html` em qualquer servidor HTTP local ou acesse pelo navegador do celular.

**Teclado:** `A/D` ou setas = mover | `Espaço` = pular  
**Mobile:** botões na tela

## Mapas de Teste Incluídos

| Mapa | Tema |
|------|------|
| `ruinas` | Cripta gótica com lua de sangue e névoa densa |
| `pantano` | Pântano tóxico com cipós suspensos e névoa esverdeada |

## Documentação

Consulte [`INSTRUCOES_MOVIMENTACAO.md`](INSTRUCOES_MOVIMENTACAO.md) para especificação completa da arquitetura, física e guia artístico.

## Versões

| Versão | Descrição |
|--------|-----------|
| v1.0.0 | Motor base: colisão pixel-mask, 3 camadas, portais, física Metroidvania, touch mobile |
