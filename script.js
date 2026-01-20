/* script.js - v3.5: IPHONE ASPECT RATIO FIX & POWERUPS */

// 1. SUPABASE
const SUPABASE_URL = 'https://rhttiiwsouqnlwoqpcvb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_EamNmDEcYnm9qeKTiSw7Rw_Sb9BVsVW';
const dbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 2. CONFIGURAZIONE GIOCO
const W = 160; const H = 160;
const PLAYER_SPEED_CELLS = 1; 
const WIN_PERCENT = 75;
const START_LIVES = 3;
const MAX_LEVEL = 10; 

const POINTS_PER_LEVEL = 1000; 
const MAX_TIME_BONUS = 500;     
const POINTS_PER_FILL = 10;     
const POINTS_KILL_SPIDER = 500; 
const POINTS_KILL_EVIL = 1000;  

// BONUS VELOCITÀ
const SPEED_BOOST_PER_KILL = 0.25; // +25% velocità per ogni nemico ucciso

// Configurazione ZOOM Mobile
const MOBILE_ZOOM_LEVEL = 1.15; 
const MOBILE_BREAKPOINT = 768;

const CELL_UNCLAIMED = 0; const CELL_CLAIMED = 1; const CELL_STIX = 2;

const SKINS = [
    { name: "CLASSIC",   primary: '#ffff00', secondary: '#ffaa00', trail: '#00ffff' },
    { name: "MATRIX",    primary: '#00ff00', secondary: '#003300', trail: '#008800' },
    { name: "INFERNO",   primary: '#ff3300', secondary: '#ffaa00', trail: '#ff0000' },
    { name: "ICE",       primary: '#ffffff', secondary: '#aaccff', trail: '#0088ff' },
    { name: "CYBERPUNK", primary: '#ff00ff', secondary: '#00ffff', trail: '#ffff00' },
    { name: "GOLD",      primary: '#ffd700', secondary: '#ffcc00', trail: '#ffffff' }
];
let currentSkin = SKINS[0];

const MISSION_PREFIX = ["OPERATION", "PROTOCOL", "PROJECT", "INITIATIVE", "CODE"];
const MISSION_SUFFIX = ["OMEGA", "ZERO", "GHOST", "NEON", "STORM", "PHANTOM", "ECHO"];

// DOM
const imageCanvas = document.getElementById('imageCanvas');
const gridCanvas = document.getElementById('gridCanvas');
const entityCanvas = document.getElementById('entityCanvas');
const nextLevelContainer = document.getElementById('next-level-container');
const nextLevelBtn = document.getElementById('next-level-btn');
const gameWrapper = document.getElementById('game-wrapper');
const cameraLayer = document.getElementById('camera-layer');

// LEADERBOARD DOM
const gameOverScreen = document.getElementById('game-over-screen');
const endTitle = document.getElementById('end-title');
const finalScoreVal = document.getElementById('final-score-val');
const inputSection = document.getElementById('input-section');
const playerNameInput = document.getElementById('player-name');
const leaderboardList = document.getElementById('leaderboard-list');

// AUDIO
const bgMusic = document.getElementById('bg-music');
const gameoverSound = document.getElementById('gameover-sound');
const musicBtn = document.getElementById('music-btn');
let isMusicOn = true; 

// VARIABILI STATO
const levelImages = []; 
let currentBgImage = null; 
let grid = new Uint8Array(W * H);
let stixList = []; 
let lives = START_LIVES;
let level = 1;
let score = 0;
let isPlaying = false;
let isDying = false; 
let isVictory = false; 
let scaleX = 1, scaleY = 1;
let levelStartTime = 0; 
let currentPercent = 0;
let playerAngle = 0;
let playerAnimScale = 0; 
let shakeIntensity = 0;  
let flashList = []; 
let particles = [];       
let floatingTexts = []; 
let player = { x: Math.floor(W/2), y: H-1, drawing: false, dir: {x:0,y:0} };
let qixList = []; 
let evilPlayers = []; 

// VARIABILI VELOCITÀ & GOD MODE
let cheatBuffer = "";
let isGodMode = false;
let cheatDetected = false; 
let playerSpeedMult = 1.0; 
let moveAccumulator = 0;   

// Contexts
let imgCtx = imageCanvas.getContext('2d', { alpha: false }); 
let gridCtx = gridCanvas.getContext('2d');
let entCtx = entityCanvas.getContext('2d');

const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = new AudioContext();

function preloadLevelImages() {
    for (let i = 1; i <= MAX_LEVEL; i++) {
        const img = new Image();
        img.src = `img${i}.jpg`; 
        levelImages[i] = img;
    }
}

// --- AUDIO ---
function playSound(type) {
    if (audioCtx.state === 'suspended') { audioCtx.resume(); }
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'fill') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(400, now); osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
        gainNode.gain.setValueAtTime(0.3, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now); osc.stop(now + 0.3);
    } else if (type === 'hit') {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(100, now); osc.frequency.exponentialRampToValueAtTime(10, now + 0.5);
        gainNode.gain.setValueAtTime(0.8, now); gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now); osc.stop(now + 0.5);
    } else if (type === 'win') {
        osc.type = 'square'; osc.frequency.setValueAtTime(500, now); osc.frequency.setValueAtTime(600, now + 0.1); osc.frequency.setValueAtTime(800, now + 0.2);
        gainNode.gain.setValueAtTime(0.2, now); gainNode.gain.linearRampToValueAtTime(0, now + 0.6);
        osc.start(now); osc.stop(now + 0.6);
    } else if (type === 'kill') {
        // SUONO POWERUP: Tono alto e cristallino (tipo moneta/bonus)
        osc.type = 'sine'; 
        osc.frequency.setValueAtTime(600, now); 
        osc.frequency.linearRampToValueAtTime(1200, now + 0.15); // Sale veloce
        gainNode.gain.setValueAtTime(0.3, now); 
        gainNode.gain.linearRampToValueAtTime(0, now + 0.4);
        osc.start(now); osc.stop(now + 0.4);
        
        // Aggiungiamo un secondo oscillatore per l'effetto "magico"
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2); gain2.connect(audioCtx.destination);
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(900, now);
        osc2.frequency.linearRampToValueAtTime(1800, now + 0.15);
        gain2.gain.setValueAtTime(0.1, now); gain2.gain.linearRampToValueAtTime(0, now + 0.4);
        osc2.start(now); osc2.stop(now + 0.4);
    }
}

function tryPlayMusic() {
    if (isMusicOn && bgMusic && bgMusic.paused) {
        bgMusic.play().catch(e => { console.log("Musica attende interazione..."); });
    }
}

if(musicBtn) {
    musicBtn.addEventListener('click', () => {
        isMusicOn = !isMusicOn;
        if (isMusicOn) {
            if(bgMusic) bgMusic.play();
            musicBtn.textContent = "🎵"; musicBtn.classList.remove('off');
        } else {
            if(bgMusic) bgMusic.pause();
            musicBtn.textContent = "🔇"; musicBtn.classList.add('off');
        }
        musicBtn.blur();
    });
}

function redrawStaticLayers() {
    if (!currentBgImage) return;
    imgCtx.drawImage(currentBgImage, 0, 0, imageCanvas.width, imageCanvas.height);
    gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
    gridCtx.drawImage(currentBgImage, 0, 0, gridCanvas.width, gridCanvas.height);
    gridCtx.save();
    gridCtx.fillStyle = 'rgba(0, 0, 0, 0.85)'; 
    gridCtx.fillRect(0, 0, gridCanvas.width, gridCanvas.height);
    gridCtx.restore();

    let rectSizeX = Math.ceil(scaleX);
    let rectSizeY = Math.ceil(scaleY);

    gridCtx.globalCompositeOperation = 'destination-out';
    gridCtx.beginPath();
    for(let y=0; y<H; y++){ 
        for(let x=0; x<W; x++){ 
            if(grid[idx(x,y)] === CELL_CLAIMED) {
                gridCtx.rect(Math.floor(x*scaleX), Math.floor(y*scaleY), rectSizeX, rectSizeY);
            }
        }
    }
    gridCtx.fill();
    gridCtx.globalCompositeOperation = 'source-over'; 
}

// --- FIX PROPORZIONI IPHONE ---

function resizeCanvases() {
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    
    // Calcola la dimensione ideale basata sullo spazio disponibile
    // 90% della larghezza o 60% dell'altezza (lasciando spazio a HUD e bottoni)
    let size = Math.min(winW * 0.9, winH * 0.60);
    
    if (size > 650) size = 650; // Limite desktop

    // FORZA il wrapper a essere un quadrato perfetto in pixel
    gameWrapper.style.width = Math.floor(size) + "px";
    gameWrapper.style.height = Math.floor(size) + "px";

    const dpr = window.devicePixelRatio || 1;
    [imageCanvas, gridCanvas, entityCanvas].forEach(c => {
        c.width = Math.floor(size * dpr);
        c.height = Math.floor(size * dpr);
    });
    
    scaleX = (size * dpr) / W;
    scaleY = (size * dpr) / H;
    
    redrawStaticLayers();
    if(isVictory) drawVictory(); 
}

function idx(x,y){ return y * W + x; }
function inBounds(x,y){ return x>=0 && x<W && y>=0 && y<H; }

function initGrid(){
    grid.fill(CELL_UNCLAIMED);
    for(let x=0;x<W;x++){ grid[idx(x,0)] = CELL_CLAIMED; grid[idx(x,H-1)] = CELL_CLAIMED; }
    for(let y=0;y<H;y++){ grid[idx(0,y)] = CELL_CLAIMED; grid[idx(W-1,y)] = CELL_CLAIMED; }
    redrawStaticLayers();
}

function spawnFloatingText(text, x, y, size = 24, color = 'white', duration = 3500) {
    floatingTexts.push({text, x, y, timer: duration, opacity: 1.0, size, color});
}

function pickRandomSkin() {
    const randomIndex = Math.floor(Math.random() * SKINS.length);
    currentSkin = SKINS[randomIndex];
}

function generateMissionName() {
    const p = MISSION_PREFIX[Math.floor(Math.random() * MISSION_PREFIX.length)];
    const s = MISSION_SUFFIX[Math.floor(Math.random() * MISSION_SUFFIX.length)];
    return `${p}: ${s}`;
}

function initGame(lvl, resetLives = true){
    if(gameOverScreen) gameOverScreen.classList.add('hidden');
    level = lvl;

    if (bgMusic) {
        let nuovaMusica = (level >= 5) ? 'part2.mp3' : 'soundtrack.mp3';
        if (!bgMusic.src.includes(nuovaMusica)) {
            bgMusic.src = nuovaMusica;
            bgMusic.load();
            if (isMusicOn) {
                bgMusic.play().catch(e => console.log("Errore riproduzione musica:", e));
            }
        }
    }

    if (resetLives) { 
        lives = START_LIVES; 
        score = 0; 
        pickRandomSkin(); 
        isGodMode = false;
        cheatDetected = false; 
    }
    
    playerSpeedMult = 1.0;
    moveAccumulator = 0;

    levelStartTime = Date.now();
    flashList = []; particles = []; floatingTexts = [];
    currentPercent = 0; playerAngle = 0; playerAnimScale = 0; shakeIntensity = 0;
    
    isPlaying = true; isDying = false; isVictory = false;
    if(nextLevelContainer) nextLevelContainer.style.display = 'none'; 
    gameWrapper.style.cursor = 'none';

    if(cameraLayer) cameraLayer.style.transform = 'translate(0px, 0px) scale(1)';

    let imgSource = `img${level}.jpg`;
    currentBgImage = new Image();
    currentBgImage.src = imgSource;
    currentBgImage.onload = () => { redrawStaticLayers(); };
    currentBgImage.onerror = () => { 
        currentBgImage.src = `img${level}.png`; 
        currentBgImage.onload = () => redrawStaticLayers();
    };

    initGrid(); 
    stixList = [];
    player.x = Math.floor(W/2); player.y = H-1;
    player.drawing = false; 
    player.dir = {x:0,y:0}; 
    
    qixList = [];
    evilPlayers = []; 

    let numSpiders = 1;
    if (level >= 8) numSpiders = 4; else if (level >= 7) numSpiders = 3; else if (level >= 5) numSpiders = 2; 

    for(let i=0; i<numSpiders; i++) {
        let startX = Math.floor(W * 0.3) + (i * 20);
        let startY = Math.floor(H * 0.3) + (i * 10);
        if(startX >= W-2) startX = W-10; if(startY >= H-2) startY = H-10;
        qixList.push({
            x: startX, y: startY,
            vx: (Math.random() * 0.8 + 0.4) * (Math.random() < 0.5 ? -1 : 1),
            vy: (Math.random() * 0.8 + 0.4) * (Math.random() < 0.5 ? -1 : 1)
        });
    }

    let numEvilBalls = 0;
    if (level === 9) numEvilBalls = 1;
    if (level === 10) numEvilBalls = 2;

    for (let i = 0; i < numEvilBalls; i++) {
        let ex = Math.floor(W/2) + (Math.random() > 0.5 ? 40 : -40);
        let ey = Math.floor(H/3);
        evilPlayers.push({
            x: ex, y: ey,
            vx: (Math.random() * 0.9 + 0.5) * (Math.random() < 0.5 ? -1 : 1),
            vy: (Math.random() * 0.9 + 0.5) * (Math.random() < 0.5 ? -1 : 1),
            angle: 0
        });
    }

    resizeCanvases();
    updateUI();
    tryPlayMusic(); 

    if(level === 1) {
        spawnFloatingText(generateMissionName(), W/2, H/2, 30, currentSkin.primary, 2500);
        spawnFloatingText(`SKIN: ${currentSkin.name}`, W/2, H/2 + 20, 16, '#888', 2000);
    }
    else if(level === 7) spawnFloatingText("FINAL STAGE!", W/2, H/2 - 10, 35, '#ff0000', 3000);
    else if (level === 9) {
        spawnFloatingText("WARNING:", W/2, H/2 - 15, 30, '#ff0000', 3000);
        spawnFloatingText("EVIL PLAYER DETECTED", W/2, H/2 + 10, 20, '#ffaa00', 3000);
    }
    else if (level === 10) {
        spawnFloatingText("BOSS BATTLE", W/2, H/2, 40, '#ff0000', 4000);
    }

    requestAnimationFrame(gameLoop);
    
    if (window.innerWidth <= MOBILE_BREAKPOINT) {
        setTimeout(() => {
            if(player.dir.x === 0 && player.dir.y === 0) player.dir = {x: 0, y: -1};
        }, 300);
    }
}

function updateUI(){
    const lvlEl = document.getElementById('ui-level');
    const livEl = document.getElementById('ui-lives');
    const perEl = document.getElementById('ui-percent');
    const scrEl = document.getElementById('ui-score');

    if(lvlEl) lvlEl.innerText = level;
    if(livEl) livEl.innerText = lives;
    if(perEl) perEl.innerText = Math.floor(currentPercent) + "%";
    if(scrEl) scrEl.innerText = score;
}

function getClaimPercent(){
    let claimed = 0;
    for(let i=0;i<grid.length;i++) if(grid[i]===CELL_CLAIMED) claimed++;
    return claimed / grid.length * 100;
}

function addShake(amount) { shakeIntensity = amount; }

function spawnParticles(x, y, type) {
    let count = 1; 
    let pColor = '#fff';

    if (type === 'explosion') count = 30; 
    else if (type === 'fill_spark') { count = 4; pColor = currentSkin.trail; }
    else if (type === 'player') { count = 1; pColor = Math.random() > 0.5 ? currentSkin.primary : currentSkin.secondary; }
    else if (type === 'spider') {
        if(level >= 6) { pColor = Math.random() > 0.5 ? '#ff0000' : '#880000'; } 
        else { pColor = Math.random() > 0.5 ? '#ff0055' : '#aa00ff'; }
    }
    else if (type === 'evil_ball') { pColor = '#ff0000'; }
    
    for(let i=0; i<count; i++){
        let p = {
            x: x + (Math.random() - 0.5) * 0.8, y: y + (Math.random() - 0.5) * 0.8,
            vx: (Math.random() - 0.5) * 0.2, vy: (Math.random() - 0.5) * 0.2,
            life: 1.0, decay: 0.08 + Math.random() * 0.05, 
            color: (type === 'explosion') ? (Math.random()>0.3?'#ff2200':'#ffffff') : pColor
        };
        if(type === 'fill_spark') { p.vx *= 2; p.vy *= 2; }
        particles.push(p);
    }
}

function updateCamera() {
    if (window.innerWidth > MOBILE_BREAKPOINT) {
        cameraLayer.style.transform = 'translate(0px, 0px) scale(1)';
        return;
    }
    const playerPixelX = (player.x + 0.5) * scaleX;
    const playerPixelY = (player.y + 0.5) * scaleY;
    const viewW = gameWrapper.clientWidth;
    const viewH = gameWrapper.clientHeight;
    let transX = (viewW / 2) - (playerPixelX * MOBILE_ZOOM_LEVEL);
    let transY = (viewH / 2) - (playerPixelY * MOBILE_ZOOM_LEVEL);
    const maxTransX = 0; const minTransX = viewW - (viewW * MOBILE_ZOOM_LEVEL);
    const maxTransY = 0; const minTransY = viewH - (viewH * MOBILE_ZOOM_LEVEL);
    transX = Math.min(maxTransX, Math.max(transX, minTransX));
    transY = Math.min(maxTransY, Math.max(transY, minTransY));
    cameraLayer.style.transform = `translate(${transX}px, ${transY}px) scale(${MOBILE_ZOOM_LEVEL})`;
}

function draw() {
    updateCamera();

    let offsetX = 0, offsetY = 0;
    if (shakeIntensity > 0) {
        offsetX = (Math.random() - 0.5) * shakeIntensity; offsetY = (Math.random() - 0.5) * shakeIntensity;
        shakeIntensity *= 0.9; if(shakeIntensity < 0.5) shakeIntensity = 0;
    }
    
    entCtx.setTransform(1, 0, 0, 1, 0, 0); 
    entCtx.clearRect(0,0,entityCanvas.width,entityCanvas.height); 
    entCtx.translate(offsetX, offsetY);
    
    let rectSizeX = Math.ceil(scaleX), rectSizeY = Math.ceil(scaleY);

    if(stixList.length > 0){
        const pulse = Math.sin(Date.now() / 50) > 0 ? '#ffffff' : currentSkin.trail;
        entCtx.fillStyle = pulse; entCtx.beginPath();
        for(let p of stixList){ entCtx.rect(Math.floor(p.x*scaleX), Math.floor(p.y*scaleY), rectSizeX, rectSizeY); }
        entCtx.fill(); 
    }

    if(flashList.length > 0) {
        entCtx.save(); entCtx.fillStyle = 'white'; entCtx.shadowColor = 'white'; entCtx.shadowBlur = 20; entCtx.beginPath();
        for (let i = flashList.length - 1; i >= 0; i--) {
            let f = flashList[i];
            let fx = f.idx % W; let fy = Math.floor(f.idx / W);
            entCtx.rect(Math.floor(fx * scaleX), Math.floor(fy * scaleY), rectSizeX, rectSizeY);
            f.timer--; if (f.timer <= 0) flashList.splice(i, 1);
        }
        entCtx.fill(); entCtx.restore(); 
    }

    if (isPlaying) {
        for(let i = particles.length - 1; i >= 0; i--){
            let p = particles[i]; entCtx.fillStyle = p.color; entCtx.globalAlpha = p.life;
            entCtx.fillRect(p.x * scaleX, p.y * scaleY, scaleX, scaleY);
            entCtx.globalAlpha = 1.0; p.x += p.vx; p.y += p.vy; p.vx *= 0.95; p.vy *= 0.95; p.life -= p.decay;
            if(p.life <= 0) particles.splice(i, 1);
        }
        
        for (let q of qixList) {
            entCtx.save(); entCtx.translate((q.x + 0.5) * scaleX, (q.y + 0.5) * scaleY);
            let angle = Math.atan2(q.vy, q.vx); entCtx.rotate(angle + Math.PI / 2);
            if(isDying) { entCtx.shadowColor = 'red'; entCtx.shadowBlur = 20; } 
            else if (level >= 6) { entCtx.shadowColor = '#ff0000'; entCtx.shadowBlur = 20; }
            entCtx.font = `${Math.min(scaleX, scaleY) * 7.5}px serif`; entCtx.textAlign = 'center'; entCtx.textBaseline = 'middle';
            entCtx.fillText('🕷️', 0, 0); entCtx.restore();
        }

        for (let ep of evilPlayers) {
            entCtx.save(); entCtx.translate((ep.x + 0.5) * scaleX, (ep.y + 0.5) * scaleY);
            ep.angle += 0.1; 
            entCtx.rotate(ep.angle);
            entCtx.shadowColor = '#ff0000'; entCtx.shadowBlur = 25; 
            entCtx.font = `${Math.min(scaleX, scaleY) * 5.5}px sans-serif`; entCtx.textAlign = 'center'; entCtx.textBaseline = 'middle';
            entCtx.fillText('⚽', 0, 0); 
            entCtx.restore();
        }

        if (isDying) playerAnimScale = Math.max(0, playerAnimScale - 0.1); else playerAnimScale = Math.min(1, playerAnimScale + 0.05); 
        if(playerAnimScale > 0.01) {
            entCtx.save(); entCtx.translate((player.x + 0.5) * scaleX, (player.y + 0.5) * scaleY);
            entCtx.scale(playerAnimScale, playerAnimScale);
            if (!isDying && (player.dir.x !== 0 || player.dir.y !== 0)) playerAngle += (Math.random() - 0.5) * 1.5; 
            entCtx.rotate(playerAngle);
            
            const blinkPhase = Math.sin((Date.now() / 500) * Math.PI); const glowBlur = 10 + 10 * Math.abs(blinkPhase); 
            entCtx.shadowColor = currentSkin.trail; entCtx.shadowBlur = glowBlur;
            
            entCtx.font = `${Math.min(scaleX, scaleY) * 5.5}px sans-serif`; entCtx.textAlign = 'center'; entCtx.textBaseline = 'middle';
            entCtx.fillText('⚽', 0, 0); entCtx.restore(); 
        }
        
        for(let i = floatingTexts.length - 1; i >= 0; i--){
            let ft = floatingTexts[i]; entCtx.save(); let color = ft.color || 'white'; entCtx.fillStyle = color; entCtx.globalAlpha = ft.opacity;
            let fontSize = ft.size || 24; entCtx.font = `bold ${fontSize}px 'Orbitron', sans-serif`; entCtx.textAlign = 'center'; entCtx.shadowColor = color; entCtx.shadowBlur = 10;
            let drawX = (ft.x + 0.5) * scaleX; let drawY = (ft.y + 0.5) * scaleY - 30 - (1.0 - ft.opacity)*20; 
            entCtx.fillText(ft.text, drawX, drawY); entCtx.globalAlpha = 1.0; entCtx.restore();
            ft.timer -= deltaTime; if(ft.timer < 500) ft.opacity = ft.timer / 500;
            if(ft.timer <= 0) floatingTexts.splice(i, 1);
        }
    }
}

function closeStixAndFill(){
    if(stixList.length===0) return;

    for (let p of stixList) {
        grid[idx(p.x, p.y)] = CELL_CLAIMED;
    }

    let visited = new Uint8Array(W * H);
    let areas = [];

    for (let i = 0; i < W * H; i++) {
        if (grid[i] === CELL_UNCLAIMED && !visited[i]) {
            let currentArea = [];
            let stack = [i];
            visited[i] = 1;

            while (stack.length > 0) {
                let curr = stack.pop();
                currentArea.push(curr);
                
                let cx = curr % W;
                let cy = Math.floor(curr / W);

                const neighbors = [];
                if (cx > 0) neighbors.push(curr - 1);
                if (cx < W - 1) neighbors.push(curr + 1);
                if (cy > 0) neighbors.push(curr - W);
                if (cy < H - 1) neighbors.push(curr + W);

                for (let n of neighbors) {
                    if (grid[n] === CELL_UNCLAIMED && !visited[n]) {
                        visited[n] = 1;
                        stack.push(n);
                    }
                }
            }
            areas.push(currentArea);
        }
    }

    if (areas.length === 0) return 0; 

    areas.sort((a, b) => b.length - a.length);

    let mainArea = areas[0]; 
    let capturedAreas = areas.slice(1); 

    let filledCount = 0;
    let rectSizeX = Math.ceil(scaleX);
    let rectSizeY = Math.ceil(scaleY);

    gridCtx.globalCompositeOperation = 'destination-out';
    gridCtx.beginPath();

    for (let area of capturedAreas) {
        for (let idxVal of area) {
            grid[idxVal] = CELL_CLAIMED;
            filledCount++;
            flashList.push({idx: idxVal, timer: 15});

            let x = idxVal % W;
            let y = Math.floor(idxVal / W);
            gridCtx.rect(Math.floor(x*scaleX), Math.floor(y*scaleY), rectSizeX, rectSizeY);
        }
    }
    gridCtx.fill();
    gridCtx.globalCompositeOperation = 'source-over'; 

    stixList = []; 

    let killed = false;

    // RAGNI
    for (let i = qixList.length - 1; i >= 0; i--) {
        let q = qixList[i];
        let qIdx = idx(Math.floor(q.x), Math.floor(q.y));
        if (grid[qIdx] === CELL_CLAIMED) {
            spawnParticles(q.x, q.y, 'explosion');
            playSound('kill'); 
            qixList.splice(i, 1);
            score += POINTS_KILL_SPIDER;
            spawnFloatingText("ENEMY KILLED!", q.x, q.y, 20, '#ff0000');
            spawnFloatingText("SPEED UP!", q.x, q.y + 20, 20, '#00ffff', 2000);
            
            // BOOST VELOCITÀ
            playerSpeedMult += SPEED_BOOST_PER_KILL;
            killed = true;
        }
    }

    // PALLE NEMICHE
    for (let i = evilPlayers.length - 1; i >= 0; i--) {
        let ep = evilPlayers[i];
        let epIdx = idx(Math.floor(ep.x), Math.floor(ep.y));
        if (grid[epIdx] === CELL_CLAIMED) {
            spawnParticles(ep.x, ep.y, 'explosion');
            playSound('kill');
            evilPlayers.splice(i, 1);
            score += POINTS_KILL_EVIL;
            spawnFloatingText("RIVAL ELIMINATED!", ep.x, ep.y, 20, '#ff0000');
            spawnFloatingText("SPEED UP!", ep.x, ep.y + 20, 20, '#00ffff', 2000);

            // BOOST VELOCITÀ
            playerSpeedMult += SPEED_BOOST_PER_KILL;
            killed = true;
        }
    }

    if(filledCount > 0) {
        if (!killed) playSound('fill'); 
        score += POINTS_PER_FILL; 
        let newPercent = getClaimPercent(); 
        spawnFloatingText(Math.floor(newPercent) + "%", player.x, player.y);
        currentPercent = newPercent; 
        if(filledCount > 50) spawnParticles(player.x, player.y, 'fill_spark');
    }

    updateUI(); 

    if (getClaimPercent() >= WIN_PERCENT || (qixList.length === 0 && evilPlayers.length === 0)) { 
        winLevel(); 
    }

    return filledCount;
}

function checkCollisions(){
    for (let q of qixList) {
        let qixCellX = Math.floor(q.x); let qixCellY = Math.floor(q.y);
        if(inBounds(qixCellX,qixCellY) && grid[idx(qixCellX,qixCellY)]===CELL_STIX){ triggerDeath(q.x, q.y); return; }
        if(player.drawing){ if(qixCellX===player.x && qixCellY===player.y){ triggerDeath(player.x, player.y); return; } }
    }
    
    for (let ep of evilPlayers) {
        let dx = ep.x - player.x;
        let dy = ep.y - player.y;
        let distance = Math.sqrt(dx*dx + dy*dy);
        
        if(distance < 1.5) {
            triggerDeath(player.x, player.y);
            return;
        }
        
        let epCellX = Math.floor(ep.x); let epCellY = Math.floor(ep.y);
        if(inBounds(epCellX,epCellY) && grid[idx(epCellX,epCellY)]===CELL_STIX) {
            triggerDeath(ep.x, ep.y);
            return;
        }
    }
}

function triggerDeath(impactX, impactY) {
    if(isDying) return; 
    if (isGodMode) return; 

    isDying = true; playSound('hit'); addShake(20); spawnParticles(impactX, impactY, 'explosion');
    setTimeout(() => { resetAfterDeath(); }, 2000);
}

function resetAfterDeath(){
    lives -= 1; updateUI(); isDying = false; 
    if(lives <= 0){
        isPlaying = false; if(bgMusic) bgMusic.pause();
        if(gameoverSound) { gameoverSound.currentTime = 0; gameoverSound.play().catch(e => console.log(e)); }
        gestisciFinePartita(false);
    } else {
        stixList = []; player.drawing = false; player.dir = {x:0,y:0}; player.x = Math.floor(W/2); player.y = H-1;
        playerAnimScale = 0; 
        
        playerSpeedMult = 1.0; 
        moveAccumulator = 0;

        qixList = []; 
        let numSpiders = 1;
        if (level >= 8) numSpiders = 4; else if (level >= 7) numSpiders = 3; else if (level >= 5) numSpiders = 2; 

        for(let i=0; i<numSpiders; i++) {
            let startX = Math.floor(W * 0.3) + (i * 20); let startY = Math.floor(H * 0.3) + (i * 10);
            if(startX >= W-2) startX = W-10; if(startY >= H-2) startY = H-10;
            qixList.push({
                x: startX, y: startY,
                vx: (Math.random() * 0.8 + 0.4) * (Math.random() < 0.5 ? -1 : 1),
                vy: (Math.random() * 0.8 + 0.4) * (Math.random() < 0.5 ? -1 : 1)
            });
        }
        
        evilPlayers = [];
        let numEvilBalls = 0;
        if (level === 9) numEvilBalls = 1;
        if (level === 10) numEvilBalls = 2;

        for (let i = 0; i < numEvilBalls; i++) {
            let ex = Math.floor(W/2) + (Math.random() > 0.5 ? 40 : -40);
            let ey = Math.floor(H/3);
            evilPlayers.push({
                x: ex, y: ey,
                vx: (Math.random() * 0.9 + 0.5) * (Math.random() < 0.5 ? -1 : 1),
                vy: (Math.random() * 0.9 + 0.5) * (Math.random() < 0.5 ? -1 : 1),
                angle: 0
            });
        }
        
        for(let i=0; i<grid.length; i++) {
            if(grid[i]===CELL_STIX) {
                grid[i] = CELL_UNCLAIMED;
            }
        }
        
        redrawStaticLayers();
        flashList = [];
    }
}

function moveQix(){
    for (let q of qixList) {
        let nx = q.x + q.vx; let ny = q.y + q.vy;
        if(!inBounds(Math.floor(nx), Math.floor(q.y)) || grid[idx(Math.floor(nx), Math.floor(q.y))]===CELL_CLAIMED) q.vx *= -1;
        if(!inBounds(Math.floor(q.x), Math.floor(ny)) || grid[idx(Math.floor(q.x), Math.floor(ny))]===CELL_CLAIMED) q.vy *= -1;
        q.x += q.vx; q.y += q.vy; spawnParticles(q.x, q.y, 'spider');
        if(Math.random() < 0.02) { q.vx += (Math.random() - 0.5) * 1.5; q.vy += (Math.random() - 0.5) * 1.5; }
        const difficultyMultiplier = 1 + ((level - 1) * 0.1); const maxSpeed = 1.2 * difficultyMultiplier; 
        const s = Math.hypot(q.vx, q.vy); if(s > maxSpeed){ q.vx *= maxSpeed/s; q.vy *= maxSpeed/s; }
    }
    
    for (let ep of evilPlayers) {
        let nx = ep.x + ep.vx; let ny = ep.y + ep.vy;
        if(!inBounds(Math.floor(nx), Math.floor(ep.y)) || grid[idx(Math.floor(nx), Math.floor(ep.y))]===CELL_CLAIMED) ep.vx *= -1;
        if(!inBounds(Math.floor(ep.x), Math.floor(ny)) || grid[idx(Math.floor(ep.x), Math.floor(ny))]===CELL_CLAIMED) ep.vy *= -1;
        ep.x += ep.vx; ep.y += ep.vy; 
        if(Math.random() < 0.02) { ep.vx += (Math.random() - 0.5) * 1.5; ep.vy += (Math.random() - 0.5) * 1.5; }
        const maxSpeed = 1.4; 
        const s = Math.hypot(ep.vx, ep.vy); if(s > maxSpeed){ ep.vx *= maxSpeed/s; ep.vy *= maxSpeed/s; }
    }
}

function winLevel() {
    isPlaying = false; playSound('win');
    let levelScore = POINTS_PER_LEVEL; let timeTakenSeconds = (Date.now() - levelStartTime) / 1000;
    let timeBonus = Math.max(0, MAX_TIME_BONUS - Math.floor(timeTakenSeconds * 5));
    score += (levelScore + timeBonus);
    
    grid.fill(CELL_CLAIMED); 
    gridCtx.clearRect(0,0,gridCanvas.width, gridCanvas.height);
    
    flashList = []; particles = []; floatingTexts = [];
    draw(); gameWrapper.style.cursor = 'default'; 
    if (level >= MAX_LEVEL) {
        isVictory = true; drawVictory(); 
        setTimeout(() => { gestisciFinePartita(true); }, 2000);
    } else {
        if(nextLevelContainer) nextLevelContainer.style.display = 'block'; 
    }
}

if(nextLevelBtn) nextLevelBtn.addEventListener('click', () => { initGame(level + 1, false); });

function tickPlayer(){
    if(player.dir.x===0 && player.dir.y===0) return;
    spawnParticles(player.x, player.y, 'player');
    const nx = player.x + player.dir.x * PLAYER_SPEED_CELLS; const ny = player.y + player.dir.y * PLAYER_SPEED_CELLS;
    if(!inBounds(nx,ny)) return;
    const curType = grid[idx(player.x, player.y)]; const nextType = grid[idx(nx, ny)];
    if(curType===CELL_CLAIMED && nextType===CELL_UNCLAIMED){ player.drawing = true; }
    if(player.drawing && nextType===CELL_CLAIMED){
        player.x = nx; player.y = ny; const filled = closeStixAndFill(); player.drawing = false; 
        updateUI(); 
        return;
    }
    if(player.drawing){ 
        const nextId = idx(nx, ny);
        if(grid[nextId] === CELL_STIX) {
            if(stixList.length >= 2) {
                const prevPoint = stixList[stixList.length - 2];
                if (prevPoint.x === nx && prevPoint.y === ny) {
                    const currentPoint = stixList.pop(); grid[idx(currentPoint.x, currentPoint.y)] = CELL_UNCLAIMED; 
                    player.x = nx; player.y = ny; return; 
                }
            }
            triggerDeath(nx, ny); return; 
        }
        player.x = nx; player.y = ny; grid[nextId] = CELL_STIX; stixList.push({x:player.x,y:player.y}); 
    } else { player.x = nx; player.y = ny; }
}

let lastTime = performance.now(); let deltaTime = 0;
function gameLoop(now){
    if (!isPlaying && !isVictory) return;
    deltaTime = now - lastTime; lastTime = now;
    if (!isDying && !isVictory) { 
        moveQix(); 
        
        // --- LOGICA VELOCITÀ AUMENTATA (Accumulatore) ---
        moveAccumulator += (1 * playerSpeedMult); 
        
        while (moveAccumulator >= 1) {
            tickPlayer();
            checkCollisions(); 
            moveAccumulator -= 1;
            
            if(isDying || isVictory) break; 
        }
    }
    if(!isVictory) draw();
    requestAnimationFrame(gameLoop);
}

// --- DB FUNZIONI ---
async function gestisciFinePartita(vittoria) {
    if(!gameOverScreen) { alert("GAME OVER! Punteggio: " + score); window.location.reload(); return; }
    gameOverScreen.classList.remove('hidden'); finalScoreVal.innerText = score;
    if (vittoria) { endTitle.innerText = "HAI VINTO!"; endTitle.style.color = "#00ff00"; } 
    else { endTitle.innerText = "GAME OVER"; endTitle.style.color = "red"; }
    await checkAndShowLeaderboard();
}

async function checkAndShowLeaderboard() {
    // 1. Reset visuale: mostra caricamento e nasconde input all'inizio
    leaderboardList.innerHTML = "<li>Caricamento dati...</li>"; 
    inputSection.classList.add('hidden'); 
    inputSection.style.display = 'none'; // Sicurezza extra CSS
    
    // --- CONTROLLO ANTI-TRUCCO ---
    // Se hai usato i trucchi, ti mostra la classifica ma ti impedisce di salvare
    if (cheatDetected) {
        leaderboardList.innerHTML = "<li style='color: var(--danger)'>Punteggio non valido (Trucchi attivi).</li>";
        let { data: classifica } = await dbClient.from('classifica').select('*').order('punteggio', { ascending: false }).limit(10);
        disegnaLista(classifica);
        return; // ESCE QUI: Non mostra l'input
    }

    // 2. Scarica la classifica
    let { data: classifica, error } = await dbClient.from('classifica').select('*').order('punteggio', { ascending: false }).limit(10);
    
    if (error) { 
        console.error("Errore Supabase:", error); 
        leaderboardList.innerHTML = "<li>Errore caricamento dati.</li>"; 
        return; 
    }
    
    // 3. Calcola se entri in classifica
    let entraInClassifica = false;
    
    // Se ci sono meno di 10 record, entri di sicuro (purché score > 0)
    if (classifica.length < 10) {
        entraInClassifica = true;
    } 
    // Altrimenti, entri solo se hai battuto il 10° classificato
    else if (score > classifica[9].punteggio) {
        entraInClassifica = true;
    }
    
    // Se hai fatto 0 punti, non entri mai
    if (score === 0) entraInClassifica = false;

    // 4. MOSTRA L'INPUT (Logica rafforzata)
    if (entraInClassifica) {
        console.log("Nuovo Record! Mostro input."); // Debug in console
        inputSection.classList.remove('hidden');
        inputSection.style.display = 'block'; // Forza visualizzazione CSS
    } else {
        console.log("Niente record. Punteggio: " + score);
    }

    disegnaLista(classifica);
}

function disegnaLista(data) {
    leaderboardList.innerHTML = "";
    if(!data || data.length === 0) { leaderboardList.innerHTML = "<li>Nessun record ancora.</li>"; return; }
    data.forEach((item, index) => {
        const li = document.createElement('li');
        li.innerHTML = `<span>#${index + 1} ${item.nome}</span><span>${item.punteggio}</span>`;
        leaderboardList.appendChild(li);
    });
}

window.salvaPunteggio = async function() {
    if (cheatDetected) { alert("Non puoi salvare il punteggio usando i trucchi!"); return; }

    const nome = playerNameInput.value.trim();
    if (nome.length === 0 || nome.length > 8) { alert("Inserisci un nome valido (1-8 caratteri)"); return; }
    const btn = document.getElementById('btn-save'); if(btn) { btn.disabled = true; btn.innerText = "Salvataggio..."; }
    
    const { error } = await dbClient.from('classifica').insert([{ nome: nome, punteggio: score }]);
    
    if (error) { 
        console.error("ERRORE SALVATAGGIO:", error);
        alert("Errore: " + error.message + " (Codice: " + error.code + ")"); 
        if(btn) btn.disabled = false; 
    } else { 
        inputSection.classList.add('hidden'); 
        const { data } = await dbClient.from('classifica').select('*').order('punteggio', { ascending: false }).limit(10); 
        disegnaLista(data); 
    }
}

window.riavviaGioco = function() { window.location.reload(); }

const keysDown = new Set();
window.addEventListener('keydown', (e)=>{
    if(e.repeat) return; 

    cheatBuffer += e.key.toLowerCase();
    if (cheatBuffer.length > 5) {
        cheatBuffer = cheatBuffer.slice(-5);
    }
    if (cheatBuffer === "iddqd" && !isGodMode) {
        isGodMode = true;
        cheatDetected = true;
        spawnFloatingText("GOD MODE ACTIVE", player.x, player.y, 30, '#ffff00', 4000);
        console.log("God Mode Activated!");
    }

    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){ keysDown.add(e.key); tryPlayMusic(); if (audioCtx.state === 'suspended') { audioCtx.resume(); } setPlayerDirFromKeys(); e.preventDefault(); }
});

window.addEventListener('keyup', (e)=>{ if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){ keysDown.delete(e.key); setPlayerDirFromKeys(); e.preventDefault(); } });
function setPlayerDirFromKeys(){
    const order = ['ArrowUp','ArrowRight','ArrowDown','ArrowLeft']; let found = {x:0,y:0};
    for(let k of order){ if(keysDown.has(k)){ if(k==='ArrowUp') found = {x:0,y:-1}; if(k==='ArrowDown') found = {x:0,y:1}; if(k==='ArrowLeft') found = {x:-1,y:0}; if(k==='ArrowRight') found = {x:1,y:0}; break; }}
    player.dir = found;
}

let touchStartX = 0; let touchStartY = 0;
function isButton(e) { return e.target.id === 'next-level-btn' || e.target.closest('#next-level-btn') || e.target.closest('#game-over-screen') || e.target.closest('.turn-btn'); }
gameWrapper.addEventListener('touchstart', e => { if (isButton(e)) return; tryPlayMusic(); if (audioCtx.state === 'suspended') { audioCtx.resume(); } touchStartX = e.changedTouches[0].screenX; touchStartY = e.changedTouches[0].screenY; e.preventDefault(); }, {passive: false});
gameWrapper.addEventListener('touchmove', e => { if (isButton(e)) return; e.preventDefault(); }, {passive: false});
gameWrapper.addEventListener('touchend', e => { if (isButton(e)) return; e.preventDefault(); let touchEndX = e.changedTouches[0].screenX; let touchEndY = e.changedTouches[0].screenY; handleSwipe(touchEndX - touchStartX, touchEndY - touchStartY); }, {passive: false});
function handleSwipe(dx, dy) { if (Math.abs(dx) < 30 && Math.abs(dy) < 30) return; if (Math.abs(dx) > Math.abs(dy)) player.dir = { x: dx > 0 ? 1 : -1, y: 0 }; else player.dir = { x: 0, y: dy > 0 ? 1 : -1 }; }

const turnLeftBtn = document.getElementById('btn-turn-left');
const turnRightBtn = document.getElementById('btn-turn-right');

function handleMobileTurn(direction) {
    tryPlayMusic();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const oldDir = player.dir;
    let newDir = {x: 0, y: 0};

    if (oldDir.x === 0 && oldDir.y === 0) {
         newDir = {x: 0, y: -1}; 
    } else {
        if (direction === 'right') { // ORARIO (CW)
            newDir = { x: -oldDir.y, y: oldDir.x };
        } else { // ANTIORARIO (CCW)
            newDir = { x: oldDir.y, y: -oldDir.x };
        }
    }
    player.dir = newDir;
}

if (turnLeftBtn) {
    const action = (e) => { e.preventDefault(); handleMobileTurn('left'); };
    turnLeftBtn.addEventListener('touchstart', action, { passive: false });
    turnLeftBtn.addEventListener('mousedown', action);
}
if (turnRightBtn) {
    const action = (e) => { e.preventDefault(); handleMobileTurn('right'); };
    turnRightBtn.addEventListener('touchstart', action, { passive: false });
    turnRightBtn.addEventListener('mousedown', action);
}

const loadingScreen = document.getElementById('loading-screen');
const loadingBar = document.getElementById('loading-bar');
const loadingText = document.getElementById('loading-text');
const startBtn = document.getElementById('start-game-btn');
const loadingBarContainer = document.getElementById('loading-bar-container');

function startGame() {
    resizeCanvases(); 
    initGame(1, true); 
    
    setTimeout(() => {
        player.dir = {x: 0, y: -1}; 
        if (bgMusic) { bgMusic.play().catch(e => console.log("Audio ancora bloccato")); }
    }, 200);

    setTimeout(resizeCanvases, 150);
}

preloadLevelImages(); 

let loadProgress = 0;
const loadInterval = setInterval(() => {
    loadProgress += Math.random() * 15; if(loadProgress > 100) loadProgress = 100;
    if(loadingBar) loadingBar.style.width = loadProgress + "%";
    if(loadProgress >= 100) { clearInterval(loadInterval); onLoadComplete(); }
}, 100); 

window.addEventListener('load', () => { loadProgress = 90; });

function onLoadComplete() {
    if(loadingText) { loadingText.innerText = "GIOCO CARICATO"; loadingText.style.color = "#00ff00"; }
    if(loadingBar) loadingBar.style.width = "100%";
    
    setTimeout(() => {
        if(loadingBarContainer) loadingBarContainer.style.display = 'none';
        
        // CORREZIONE QUI: Rimuoviamo la classe 'hidden' invece di cambiare style.display
        if(startBtn) {
            startBtn.classList.remove('hidden');
            // Aggiungiamo un'animazione di entrata opzionale
            startBtn.style.animation = "pulseBtn 1s infinite alternate";
        }
    }, 500);
}

if(startBtn) {
    startBtn.addEventListener('click', () => {
        if (audioCtx.state === 'suspended') { audioCtx.resume().then(() => { console.log("Audio Context Resumed"); }); }
        if(loadingScreen) loadingScreen.style.opacity = '0';
        setTimeout(() => { if(loadingScreen) loadingScreen.style.display = 'none'; startGame(); }, 500);
    });
}
window.addEventListener('resize', resizeCanvases);