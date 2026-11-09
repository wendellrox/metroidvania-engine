# Guia Completo de Arquitetura e Movimentação: Metroidvania em JavaScript

Este documento detalha passo a passo a arquitetura, física, matemática e implementação técnica de um motor de movimentação para jogos no estilo **Metroidvania** em **JavaScript (HTML5 Canvas)**.

O sistema opera com uma **arquitetura gráfica de 3 camadas por mapa**:
1. **Camada de Fundo (*Background*):** Cenário distante decorativo.
2. **Camada de Contorno e Colisão (*Collision / Terrain*):** Superfície física onde o personagem pisa, com ar livre nas áreas transparentes.
3. **Camada de Primeiro Plano (*Foreground*):** Elementos visuais que ficam **na frente de tudo** (na frente do jogador, das paredes e dos portais), ideal para névoa volumétrica, cipós, pilares frontais e efeitos de iluminação.
4. **Concatenação de Mapas via Portais:** Transição contínua entre salas/mapas com efeito suave de *fade*.
5. **Física Metroidvania Responsiva:** Pulo variável, *Coyote Time*, *Jump Buffering*, animação por *spritesheet* e subida suave de rampas/contornos (*slope stepping*).

---

## 1. Estrutura de Pastas e Nomenclatura das Camadas

O projeto organiza os recursos em subpastas dedicadas no mesmo nível do arquivo principal:

```text
meu-jogo-metroidvania/
│
├── index.html                  # Ponto de entrada (Canvas HTML5 e Touch Controls)
│
├── src/                        # Código fonte modular
│   └── game.js                 # Motor de física, colisão de 3 camadas e portais
│
├── sprites/                    # Spritesheets e gráficos de personagens
│   └── player.png              # Spritesheet com quadros de Idle e Run
│
└── maps/                       # Subpasta de imagens dos mapas (3 Camadas)
    │
    ├── ruinas.png              # [CAMADA 2] Contorno e terreno sólido da cripta
    ├── background_ruinas.png   # [CAMADA 1] Fundo: céu avermelhado, lua de sangue
    ├── foreground_ruinas.png   # [CAMADA 3] Frente: névoa densa, pilar frontal
    │
    ├── pantano.png             # [CAMADA 2] Contorno e terreno sólido do pântano
    ├── background_pantano.png  # [CAMADA 1] Fundo: céu esmeralda, vaga-lumes
    └── foreground_pantano.png  # [CAMADA 3] Frente: névoa tóxica e cipós suspensos
```

### Regras de Nomenclatura dos Mapas:
Para cada sala/mapa com nome `<nome>`:
1. **Terreno / Colisão:** `<nome>.png`
   - Contém a superfície física sólida onde o personagem anda.
   - Partes onde o personagem se move livremente pelo ar **devem ser 100% transparentes**.
2. **Fundo (*Background*):** `background_<nome>.png`
   - Desenhado atrás de todos os elementos. Pode usar velocidade de rolagem menor (*parallax*) para dar sensação de profundidade.
3. **Primeiro Plano (*Foreground*):** `foreground_<nome>.png`
   - Desenhado **à frente de tudo na tela** (acima do chão, dos portais e do próprio jogador).
   - Deve possuir transparência (Canal Alfa) para que o jogo continue visível por trás da névoa, chuva, folhas ou pilares.

---

## 2. Ordem de Renderização (*Render Stack*)

A renderização frame a frame segue rigorosamente a seguinte hierarquia visual:

```
[ TOPO DA TELA ]
   ▲
   │  6. Efeito de Fade / Transição de Tela
   │  5. CAMADA FOREGROUND (Névoa, cipós, pilares frontais)
   │  4. JOGADOR (Sprite animado com sombra projetada)
   │  3. PORTAIS (Zonas de teletransporte com brilho pulsante)
   │  2. CAMADA DE COLISÃO / TERRENO (Contorno de pedra/terra)
   │  1. CAMADA BACKGROUND (Cenário distante com parallax)
[ FUNDO DA TELA ]
```

Essa ordem garante que quando o jogador caminhar por trás de um pilar do *Foreground* ou por baixo de uma névoa rasteira, ele fique parcialmente coberto, gerando grande imersão visual típica de clássicos como *Castlevania: Symphony of the Night* e *Hollow Knight*.

---

## 3. Princípio da Colisão por Máscara de Pixels (Pixel-Mask)

Diferente de jogos baseados em blocos quadrados (*tilemaps* de 16x16), o motor lê diretamente a imagem `<nome>.png` desenhada à mão:

```
       [Ar Livre: Alpha = 0]
             \
      O       \   (Espaço livre para andar e pular)
     /|\       v
     / \     . - - - .
============/         \=============  <-- Superfície de contato
[Pixels Preenchidos: Alpha > 128]     <-- Bloqueio físico (chão/paredes)
```

### Como o Motor Lê os Pixels na Memória:
1. Ao carregar o mapa, o motor desenha `<nome>.png` em um `OffscreenCanvas`.
2. O método `context.getImageData(0, 0, width, height)` extrai um array contíguo `Uint8ClampedArray`.
3. Para consultar o ponto no mundo `(x, y)`:
   $$\text{indice} = (y \times \text{larguraDoMapa} + x) \times 4$$
4. **Condição de Sólido:**
   Se `pixelData[indice + 3] > 128` (Canal Alfa maior que 50%), o ponto é considerado **SÓLIDO**. Se for `<= 128`, o ponto é ar livre navegável.
5. **Desempenho:** A leitura da imagem via `getImageData` é feita apenas uma vez no carregamento da sala, nunca dentro do loop a 60 FPS.

---

## 4. Física e Mecânica de Movimentação do Jogador

### 4.1. Variáveis Físicas Fundamentais
- **Velocidade Horizontal Máxima (`maxSpeed`):** ~3.6 pixels/frame.
- **Aceleração no Solo (`accel`):** 0.65 para resposta ágil.
- **Atrito / Fricção (`friction`):** 0.82 (parada suave ao soltar as teclas).
- **Gravidade Padrão (`gravity`):** 0.46 durante a subida com botão pressionado.
- **Gravidade de Queda / Corte de Pulo (`fallGravity`):** 0.95 aplicada ao soltar o pulo ou durante a descida (*snappy jump*).
- **Força de Pulo (`jumpForce`):** 8.8 pixels/frame.

### 4.2. Tolerâncias de Movimento (*Game Feel*)
1. **Coyote Time (Tempo do Coiote):**
   - Janela de tolerância de 6 frames (~100ms) que permite pular mesmo após deixar a beirada de uma plataforma.
2. **Jump Buffering (Buffer de Pulo):**
   - Se o comando de pulo for apertado até 6 frames antes de tocar o solo, o herói pula no instante exato do contato.
3. **Resolução de Rampas e Degraus (*Slope Step-Up*):**
   - Ao encontrar até 4 pixels de desnível contínuo desenhado na rocha, o herói é elevado suavemente sem sofrer bloqueio de parede horizontal.
4. **Aderência ao Chão (*Step-Down*):**
   - Ao descer ladeiras, se o chão estiver a até 4 pixels abaixo dos pés, o herói permanece colado ao chão, evitando falso estado de queda.

---

## 5. Sistema de Concatenação de Mapas e Portais

Cada mapa possui portais cadastrados com coordenadas no espaço do mundo:

```javascript
const MAP_REGISTRY = {
    ruinas: {
        name: "ruinas",
        collisionSrc: "maps/ruinas.png",
        backgroundSrc: "maps/background_ruinas.png",
        foregroundSrc: "maps/foreground_ruinas.png",
        spawnX: 80,
        spawnY: 250,
        portals: [
            {
                id: "portal_para_pantano",
                x: 775,
                y: 170,
                width: 35,
                height: 125,
                targetMap: "pantano",
                targetSpawnX: 80,
                targetSpawnY: 240
            }
        ]
    },
    pantano: {
        name: "pantano",
        collisionSrc: "maps/pantano.png",
        backgroundSrc: "maps/background_pantano.png",
        foregroundSrc: "maps/foreground_pantano.png",
        spawnX: 80,
        spawnY: 240,
        portals: [
            {
                id: "portal_volta_ruinas",
                x: 20,
                y: 170,
                width: 35,
                height: 125,
                targetMap: "ruinas",
                targetSpawnX: 710,
                targetSpawnY: 250
            }
        ]
    }
};
```

### Ciclo de Transição:
1. **Contato:** O jogador encosta na área do portal.
2. **Fade Out:** A tela escurece suavemente até `alpha = 1.0`.
3. **Carregamento:** Carrega-se o trio de imagens (`<nome>.png`, `background_<nome>.png`, `foreground_<nome>.png`) da nova sala.
4. **Spawn Seguro:** O jogador é posicionado nas coordenadas `targetSpawn` com velocidade zerada e um temporizador de proteção (*cooldown*) para evitar retorno acidental.
5. **Fade In:** A tela clareia e o controle é devolvido ao jogador.

---

## 6. Guia Artístico: Como Criar as 3 Camadas

Ao desenhar no Aseprite, Photoshop, Krita ou GIMP:

1. **Camada 1: `background_<nome>.png`**
   - Pinte o céu, estrelas, montanhas e estruturas distantes.
   - Pode ser um arquivo opaco (sem necessidade de transparência).
2. **Camada 2: `<nome>.png`**
   - Desenhe o relevo físico: chão, paredes, plataformas e tetos.
   - **Obrigatório:** Onde for ar livre para voar/pular, deixe **100% transparente**.
3. **Camada 3: `foreground_<nome>.png`**
   - Desenhe os elementos atmosféricos:
     - Névoas volumétricas (com opacidade de 30% a 60%).
     - Cipós, estalactites frontais ou colunas quebradas que o herói passa por trás.
     - Partículas flutuantes ou teias de aranha.
   - **Obrigatório:** Mantenha a maior parte da imagem transparente para não tapar a visão do jogo.
