import { gameState } from './state.js';
import { drawWorld } from './world.js';
import { updatePlayer, drawPlayer } from './player.js';
import { setupUI, drawUI } from './ui.js';

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

    // Toggle crafting menu
    if (e.key === 'c') {
        gameState.ui.craftMenu.open = !gameState.ui.craftMenu.open;
    }
});

window.addEventListener('keyup', (e) => {
    if (gameState.keys.hasOwnProperty(e.key)) {
        gameState.keys[e.key] = false;
    }
});

// Initialize UI touch listeners
setupUI(canvas);

let lastTime = performance.now();

function update(deltaTime) {
    // Update player position
    updatePlayer(deltaTime);

    // Smooth camera tracking (lerp)
    const { player, camera, canvas } = gameState;
    const targetCameraX = player.x - (canvas.width / 2);
    const targetCameraY = player.y - (canvas.height / 2);

    const LERP_FACTOR = 5 * (deltaTime / 1000); // Adjust for smoothness
    camera.x += (targetCameraX - camera.x) * LERP_FACTOR;
    camera.y += (targetCameraY - camera.y) * LERP_FACTOR;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw the procedural world
    drawWorld(ctx);

    // 2. Draw the player
    drawPlayer(ctx);

    // 3. Draw UI
    drawUI(ctx);

    // Optional: Draw debug information
    ctx.fillStyle = 'white';
    ctx.font = '16px monospace';
    // Offset debug info down so it doesn't overlap Health/Hunger bars
    ctx.fillText(`Camera: (${Math.round(gameState.camera.x)}, ${Math.round(gameState.camera.y)})`, 10, 80);
    ctx.fillText(`Chunks Loaded: ${gameState.world.chunks.size}`, 10, 100);
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
