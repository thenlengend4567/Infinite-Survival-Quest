import { gameState } from './state.js';
import { drawWorld } from './world.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Keep canvas full-screen
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gameState.canvas.width = canvas.width;
    gameState.canvas.height = canvas.height;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // Initial size

// Input handling
window.addEventListener('keydown', (e) => {
    if (gameState.keys.hasOwnProperty(e.key)) {
        gameState.keys[e.key] = true;
    }
});

window.addEventListener('keyup', (e) => {
    if (gameState.keys.hasOwnProperty(e.key)) {
        gameState.keys[e.key] = false;
    }
});

let lastTime = performance.now();
const CAMERA_SPEED = 300; // pixels per second

function update(deltaTime) {
    const keys = gameState.keys;
    const moveAmount = CAMERA_SPEED * (deltaTime / 1000);

    if (keys.w || keys.ArrowUp) gameState.camera.y -= moveAmount;
    if (keys.s || keys.ArrowDown) gameState.camera.y += moveAmount;
    if (keys.a || keys.ArrowLeft) gameState.camera.x -= moveAmount;
    if (keys.d || keys.ArrowRight) gameState.camera.x += moveAmount;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the procedural world
    drawWorld(ctx);

    // Optional: Draw debug information
    ctx.fillStyle = 'white';
    ctx.font = '16px monospace';
    ctx.fillText(`Camera: (${Math.round(gameState.camera.x)}, ${Math.round(gameState.camera.y)})`, 10, 20);
    ctx.fillText(`Chunks Loaded: ${gameState.world.chunks.size}`, 10, 40);
}

function gameLoop(currentTime) {
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    update(deltaTime);
    draw();

    requestAnimationFrame(gameLoop);
}

// Start the game loop
requestAnimationFrame(gameLoop);
