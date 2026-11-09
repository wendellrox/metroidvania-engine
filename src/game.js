/**
 * Motor de Movimentação e Concatenação de Mapas Estilo Metroidvania
 * Tecnologia: HTML5 Canvas 2D + Pixel-Mask Collision + Sistema de 3 Camadas
 * Camadas:
 *   1. Background (Fundo)
 *   2. Colisão / Terreno (Superfície física onde o herói anda)
 *   3. Personagens e Portais
 *   4. Foreground (Primeiro plano: névoa, cipós, pilares na frente de tudo)
 */

// ==========================================
// 1. REGISTRO E DEFINIÇÃO DOS MAPAS (3 CAMADAS)
// ==========================================
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

// ==========================================
// 2. SISTEMA DE ENTRADA (TECLADO + TOUCH MOBILE)
// ==========================================
class InputHandler {
    constructor() {
        this.keys = {
            left: false,
            right: false,
            up: false,
            down: false,
            jump: false,
            jumpPressed: false
        };

        this.setupKeyboard();
        this.setupTouchControls();
    }

    setupKeyboard() {
        window.addEventListener("keydown", (e) => {
            if (e.repeat) return;
            if (e.code === "ArrowLeft" || e.code === "KeyA") this.keys.left = true;
            if (e.code === "ArrowRight" || e.code === "KeyD") this.keys.right = true;
            if (e.code === "ArrowUp" || e.code === "KeyW") this.keys.up = true;
            if (e.code === "ArrowDown" || e.code === "KeyS") this.keys.down = true;
            if (e.code === "Space" || e.code === "KeyK") {
                this.keys.jump = true;
                this.keys.jumpPressed = true;
            }
        });

        window.addEventListener("keyup", (e) => {
            if (e.code === "ArrowLeft" || e.code === "KeyA") this.keys.left = false;
            if (e.code === "ArrowRight" || e.code === "KeyD") this.keys.right = false;
            if (e.code === "ArrowUp" || e.code === "KeyW") this.keys.up = false;
            if (e.code === "ArrowDown" || e.code === "KeyS") this.keys.down = false;
            if (e.code === "Space" || e.code === "KeyK") this.keys.jump = false;
        });
    }

    setupTouchControls() {
        const btnLeft = document.getElementById("btn-left");
        const btnRight = document.getElementById("btn-right");
        const btnJump = document.getElementById("btn-jump");

        if (!btnLeft || !btnRight || !btnJump) return;

        const bindTouch = (el, onStart, onEnd) => {
            el.addEventListener("touchstart", (e) => { e.preventDefault(); onStart(); }, { passive: false });
            el.addEventListener("touchend", (e) => { e.preventDefault(); onEnd(); }, { passive: false });
            el.addEventListener("mousedown", (e) => { e.preventDefault(); onStart(); });
            el.addEventListener("mouseup", (e) => { e.preventDefault(); onEnd(); });
            el.addEventListener("mouseleave", (e) => { onEnd(); });
        };

        bindTouch(btnLeft, () => { this.keys.left = true; }, () => { this.keys.left = false; });
        bindTouch(btnRight, () => { this.keys.right = true; }, () => { this.keys.right = false; });
        bindTouch(btnJump, () => {
            this.keys.jump = true;
            this.keys.jumpPressed = true;
        }, () => {
            this.keys.jump = false;
        });
    }

    resetFrameKeys() {
        this.keys.jumpPressed = false;
    }
}

// ==========================================
// 3. GERENCIADOR DE MAPAS (3 CAMADAS + PIXEL DATA)
// ==========================================
class MapManager {
    constructor() {
        this.currentMapId = null;
        this.collisionImg = null;
        this.backgroundImg = null;
        this.foregroundImg = null;
        this.pixelData = null;
        this.width = 0;
        this.height = 0;
        this.portals = [];
        this.isLoaded = false;
    }

    loadImage(src) {
        return new Promise((resolve) => {
            if (!src) return resolve(null);
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => {
                console.warn(`Imagem "${src}" não encontrada ou opcional.`);
                resolve(null);
            };
            img.src = src;
        });
    }

    async loadMap(mapId) {
        this.isLoaded = false;
        const config = MAP_REGISTRY[mapId];
        if (!config) throw new Error(`Mapa com ID "${mapId}" não existe.`);

        this.currentMapId = mapId;
        this.portals = config.portals || [];

        // Carrega simultaneamente as 3 camadas
        const [collImg, bgImg, fgImg] = await Promise.all([
            this.loadImage(config.collisionSrc),
            this.loadImage(config.backgroundSrc),
            this.loadImage(config.foregroundSrc)
        ]);

        this.collisionImg = collImg;
        this.backgroundImg = bgImg;
        this.foregroundImg = fgImg;

        if (!this.collisionImg) {
            throw new Error(`Imagem de colisão obrigatória não encontrada para "${mapId}".`);
        }

        this.width = this.collisionImg.width;
        this.height = this.collisionImg.height;

        // Extrai matriz Uint8ClampedArray usando Offscreen Canvas
        const offCanvas = document.createElement("canvas");
        offCanvas.width = this.width;
        offCanvas.height = this.height;
        const offCtx = offCanvas.getContext("2d", { willReadFrequently: true });
        offCtx.drawImage(this.collisionImg, 0, 0);

        const imgData = offCtx.getImageData(0, 0, this.width, this.height);
        this.pixelData = imgData.data;

        this.isLoaded = true;
    }

    isSolid(x, y) {
        const px = Math.floor(x);
        const py = Math.floor(y);

        if (px < 0 || px >= this.width) return true; // Paredes do mapa
        if (py < 0) return false;                   // Ar livre no topo
        if (py >= this.height) return true;         // Limite inferior sólido

        const index = (py * this.width + px) * 4;
        const alpha = this.pixelData[index + 3];

        // Sólido quando o canal Alfa for superior a 128 (pixel desenhado)
        return alpha > 128;
    }
}

// ==========================================
// 4. ENTIDADE DO JOGADOR COM SPRITES E FÍSICA
// ==========================================
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 16;
        this.height = 28;

        this.vx = 0;
        this.vy = 0;

        // Parâmetros de movimentação Metroidvania
        this.maxSpeed = 3.6;
        this.accel = 0.65;
        this.friction = 0.82;
        this.gravity = 0.46;
        this.fallGravity = 0.95;
        this.jumpForce = 8.8;
        this.maxFallSpeed = 11.0;
        this.maxStepUp = 4; // Resolução suave de contornos inclinados

        this.isGrounded = false;
        this.facing = 1;
        this.state = "IDLE"; // IDLE, RUN, JUMP, FALL

        this.coyoteCounter = 0;
        this.coyoteMax = 6;
        this.jumpBufferCounter = 0;
        this.jumpBufferMax = 6;

        // Sprite
        this.spriteImg = new Image();
        this.spriteLoaded = false;
        this.spriteImg.onload = () => { this.spriteLoaded = true; };
        this.spriteImg.src = "sprites/player.png";
        this.animTimer = 0;
        this.animFrame = 0;
    }

    update(input, map) {
        // 1. Coyote Time e Jump Buffering
        if (this.isGrounded) {
            this.coyoteCounter = this.coyoteMax;
        } else {
            if (this.coyoteCounter > 0) this.coyoteCounter--;
        }

        if (input.keys.jumpPressed) {
            this.jumpBufferCounter = this.jumpBufferMax;
        } else {
            if (this.jumpBufferCounter > 0) this.jumpBufferCounter--;
        }

        // 2. Movimento Horizontal
        let moveDir = 0;
        if (input.keys.left) moveDir -= 1;
        if (input.keys.right) moveDir += 1;

        if (moveDir !== 0) {
            this.vx += moveDir * this.accel;
            if (Math.abs(this.vx) > this.maxSpeed) {
                this.vx = Math.sign(this.vx) * this.maxSpeed;
            }
            this.facing = moveDir;
        } else {
            this.vx *= this.friction;
            if (Math.abs(this.vx) < 0.1) this.vx = 0;
        }

        // 3. Pulo Responsivo e Gravidade Variável
        if (this.jumpBufferCounter > 0 && this.coyoteCounter > 0) {
            this.vy = -this.jumpForce;
            this.coyoteCounter = 0;
            this.jumpBufferCounter = 0;
            this.isGrounded = false;
        }

        if (!input.keys.jump && this.vy < -2.0) {
            this.vy += this.fallGravity;
        } else if (this.vy >= 0) {
            this.vy += this.fallGravity;
        } else {
            this.vy += this.gravity;
        }

        if (this.vy > this.maxFallSpeed) this.vy = this.maxFallSpeed;

        // 4. Execução de física contra máscara de pixels
        this.moveAndCollide(map);

        // 5. Atualização de estado e animação
        if (!this.isGrounded) {
            this.state = this.vy < 0 ? "JUMP" : "FALL";
        } else {
            this.state = Math.abs(this.vx) > 0.2 ? "RUN" : "IDLE";
        }

        this.animTimer++;
        if (this.state === "RUN") {
            if (this.animTimer % 8 === 0) {
                this.animFrame = this.animFrame === 2 ? 3 : 2;
            }
        } else {
            if (this.animTimer % 24 === 0) {
                this.animFrame = this.animFrame === 0 ? 1 : 0;
            }
        }
    }

    moveAndCollide(map) {
        // Eixo X com Step-Up para rampas
        const targetX = this.x + this.vx;
        const dirX = Math.sign(this.vx);
        const stepsX = Math.ceil(Math.abs(this.vx));

        for (let i = 0; i < stepsX; i++) {
            const stepAmount = Math.min(1.0, Math.abs(targetX - this.x)) * dirX;
            const nextX = this.x + stepAmount;

            if (!this.checkCollisionAt(nextX, this.y, map)) {
                this.x = nextX;
            } else {
                let stepped = false;
                if (this.isGrounded) {
                    for (let stepY = 1; stepY <= this.maxStepUp; stepY++) {
                        if (!this.checkCollisionAt(nextX, this.y - stepY, map)) {
                            this.x = nextX;
                            this.y -= stepY;
                            stepped = true;
                            break;
                        }
                    }
                }
                if (!stepped) {
                    this.vx = 0;
                    break;
                }
            }
        }

        // Eixo Y
        const targetY = this.y + this.vy;
        const dirY = Math.sign(this.vy);
        const stepsY = Math.ceil(Math.abs(this.vy));
        let collidedVertical = false;

        for (let i = 0; i < stepsY; i++) {
            const stepAmount = Math.min(1.0, Math.abs(targetY - this.y)) * dirY;
            const nextY = this.y + stepAmount;

            if (!this.checkCollisionAt(this.x, nextY, map)) {
                this.y = nextY;
            } else {
                collidedVertical = true;
                if (this.vy > 0) {
                    this.isGrounded = true;
                }
                this.vy = 0;
                break;
            }
        }

        if (!collidedVertical) {
            this.isGrounded = this.checkCollisionAt(this.x, this.y + 1, map);

            // Step-Down para manter os pés na descida de relevo
            if (!this.isGrounded && this.vy >= 0 && this.coyoteCounter > 0) {
                for (let down = 1; down <= this.maxStepUp; down++) {
                    if (this.checkCollisionAt(this.x, this.y + down, map)) {
                        this.y += down - 1;
                        this.isGrounded = true;
                        this.vy = 0;
                        break;
                    }
                }
            }
        }
    }

    checkCollisionAt(newX, newY, map) {
        const left = newX;
        const right = newX + this.width;
        const top = newY;
        const bottom = newY + this.height;

        const samplePoints = [
            { x: left + 2, y: bottom },
            { x: left + this.width / 2, y: bottom },
            { x: right - 2, y: bottom },
            { x: left + 2, y: top },
            { x: right - 2, y: top },
            { x: left, y: top + this.height * 0.4 },
            { x: left, y: top + this.height * 0.8 },
            { x: right, y: top + this.height * 0.4 },
            { x: right, y: top + this.height * 0.8 }
        ];

        for (const pt of samplePoints) {
            if (map.isSolid(pt.x, pt.y)) return true;
        }
        return false;
    }

    render(ctx, camera) {
        const renderX = Math.floor(this.x - camera.x);
        const renderY = Math.floor(this.y - camera.y);

        ctx.save();

        // Sombra suave aos pés
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.beginPath();
        ctx.ellipse(renderX + this.width / 2, renderY + this.height + 1, 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        if (this.spriteLoaded) {
            ctx.save();
            if (this.facing === -1) {
                ctx.scale(-1, 1);
                ctx.drawImage(
                    this.spriteImg,
                    this.animFrame * 16, 0, 16, 32,
                    -renderX - this.width, renderY - 4, 16, 32
                );
            } else {
                ctx.drawImage(
                    this.spriteImg,
                    this.animFrame * 16, 0, 16, 32,
                    renderX, renderY - 4, 16, 32
                );
            }
            ctx.restore();
        } else {
            ctx.fillStyle = this.state === "RUN" ? "#4da6ff" : (this.state === "JUMP" ? "#ffcc00" : "#00d26a");
            ctx.fillRect(renderX, renderY, this.width, this.height);

            ctx.fillStyle = "#ffffff";
            const eyeOffset = this.facing === 1 ? this.width - 5 : 2;
            ctx.fillRect(renderX + eyeOffset, renderY + 5, 3, 4);
        }

        ctx.restore();
    }
}

// ==========================================
// 5. CÂMERA COM LERP
// ==========================================
class Camera {
    constructor(viewWidth, viewHeight) {
        this.x = 0;
        this.y = 0;
        this.viewWidth = viewWidth;
        this.viewHeight = viewHeight;
        this.smooth = 0.08;
    }

    update(target, mapWidth, mapHeight) {
        const targetX = target.x + target.width / 2 - this.viewWidth / 2;
        const targetY = target.y + target.height / 2 - this.viewHeight / 2;

        this.x += (targetX - this.x) * this.smooth;
        this.y += (targetY - this.y) * this.smooth;

        this.x = Math.max(0, Math.min(this.x, Math.max(0, mapWidth - this.viewWidth)));
        this.y = Math.max(0, Math.min(this.y, Math.max(0, mapHeight - this.viewHeight)));
    }
}

// ==========================================
// 6. MOTOR DO JOGO E RENDERIZAÇÃO DE 3 CAMADAS
// ==========================================
class GameEngine {
    constructor() {
        this.canvas = document.getElementById("gameCanvas");
        this.ctx = this.canvas.getContext("2d");
        this.uiMapName = document.getElementById("map-name");
        this.uiPosInfo = document.getElementById("pos-info");

        this.input = new InputHandler();
        this.mapManager = new MapManager();
        this.camera = new Camera(this.canvas.width, this.canvas.height);
        this.player = null;

        this.isTransitioning = false;
        this.fadeAlpha = 0;
        this.fadeDirection = 0;
        this.pendingPortal = null;
        this.portalCooldown = 0;
    }

    async start() {
        // Inicializa com o novo mapa: RUINAS
        await this.mapManager.loadMap("ruinas");
        const config = MAP_REGISTRY["ruinas"];
        this.player = new Player(config.spawnX, config.spawnY);

        this.gameLoop = this.loop.bind(this);
        requestAnimationFrame(this.gameLoop);
    }

    triggerPortalTransition(portal) {
        if (this.isTransitioning || this.portalCooldown > 0) return;
        this.isTransitioning = true;
        this.fadeDirection = 1;
        this.pendingPortal = portal;
    }

    async executeMapSwitch() {
        const portal = this.pendingPortal;
        await this.mapManager.loadMap(portal.targetMap);

        this.player.x = portal.targetSpawnX;
        this.player.y = portal.targetSpawnY;
        this.player.vx = 0;
        this.player.vy = 0;

        this.camera.x = this.player.x - this.canvas.width / 2;
        this.camera.y = this.player.y - this.canvas.height / 2;

        this.portalCooldown = 40;
        this.fadeDirection = -1;
        this.pendingPortal = null;
    }

    update() {
        if (this.portalCooldown > 0) {
            this.portalCooldown--;
        }

        if (this.isTransitioning) {
            if (this.fadeDirection === 1) {
                this.fadeAlpha += 0.08;
                if (this.fadeAlpha >= 1.0) {
                    this.fadeAlpha = 1.0;
                    this.fadeDirection = 0;
                    this.executeMapSwitch();
                }
            } else if (this.fadeDirection === -1) {
                this.fadeAlpha -= 0.08;
                if (this.fadeAlpha <= 0) {
                    this.fadeAlpha = 0;
                    this.fadeDirection = 0;
                    this.isTransitioning = false;
                }
            }
            return;
        }

        if (!this.mapManager.isLoaded) return;

        this.player.update(this.input, this.mapManager);
        this.camera.update(this.player, this.mapManager.width, this.mapManager.height);

        // Detecção de colisão com portais
        for (const portal of this.mapManager.portals) {
            const overlapX = this.player.x + this.player.width > portal.x && this.player.x < portal.x + portal.width;
            const overlapY = this.player.y + this.player.height > portal.y && this.player.y < portal.y + portal.height;

            if (overlapX && overlapY) {
                this.triggerPortalTransition(portal);
                break;
            }
        }

        if (this.uiMapName) this.uiMapName.innerText = `Mapa: ${this.mapManager.currentMapId.toUpperCase()}`;
        if (this.uiPosInfo) this.uiPosInfo.innerText = `X: ${Math.floor(this.player.x)} | Y: ${Math.floor(this.player.y)} | ${this.player.state}`;

        this.input.resetFrameKeys();
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (!this.mapManager.isLoaded) {
            this.ctx.fillStyle = "#ffffff";
            this.ctx.fillText("Carregando mapa...", 20, 30);
            return;
        }

        const camX = Math.floor(this.camera.x);
        const camY = Math.floor(this.camera.y);

        // CAMADA 1: BACKGROUND (Fundo com Parallax suave)
        if (this.mapManager.backgroundImg) {
            const bgX = -Math.floor(this.camera.x * 0.5);
            const bgY = -Math.floor(this.camera.y * 0.5);
            this.ctx.drawImage(this.mapManager.backgroundImg, bgX, bgY);
        }

        // CAMADA 2: TERRENO E COLISÃO (Onde o herói pisa)
        if (this.mapManager.collisionImg) {
            this.ctx.drawImage(this.mapManager.collisionImg, -camX, -camY);
        }

        // CAMADA 3: PORTAIS E ENTIDADES DO MUNDO
        const pulse = 0.5 + 0.3 * Math.sin(Date.now() * 0.006);
        for (const p of this.mapManager.portals) {
            const px = p.x - camX;
            const py = p.y - camY;
            this.ctx.fillStyle = `rgba(180, 80, 255, ${pulse * 0.35})`;
            this.ctx.fillRect(px, py, p.width, p.height);
            this.ctx.strokeStyle = `rgba(220, 140, 255, ${pulse})`;
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(px, py, p.width, p.height);
        }

        // CAMADA 4: JOGADOR
        this.player.render(this.ctx, this.camera);

        // CAMADA 5: FOREGROUND (Frente de tudo: névoa, pilares frontais, cipós)
        if (this.mapManager.foregroundImg) {
            this.ctx.drawImage(this.mapManager.foregroundImg, -camX, -camY);
        }

        // Efeito de Transição (Fade Out / Fade In)
        if (this.fadeAlpha > 0) {
            this.ctx.fillStyle = `rgba(0, 0, 0, ${this.fadeAlpha})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    loop() {
        this.update();
        this.render();
        requestAnimationFrame(this.gameLoop);
    }
}

window.addEventListener("DOMContentLoaded", () => {
    const engine = new GameEngine();
    engine.start();
});
