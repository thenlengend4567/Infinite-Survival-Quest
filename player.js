import { gameState } from './state.js';
import { getTileAtWorldPos } from './world.js';

export function updatePlayer(deltaTime) {
    const { player, keys, ui } = gameState;
    const { joystick } = ui;

    // Determine current terrain to apply physics/speed penalties
    const currentTileId = getTileAtWorldPos(player.x, player.y);
    let speedModifier = 1.0;

    // Water Tile ID is 0
    if (currentTileId === 0) {
        speedModifier = 0.5; // Cut speed in half
    }

    const currentMaxSpeed = player.speed * speedModifier;

    // Movement vector
    let dx = 0;
    let dy = 0;
    let isMoving = false;

    // 1. Process Keyboard Input (Digital)
    if (keys.w || keys.ArrowUp) { dy -= 1; isMoving = true; }
    if (keys.s || keys.ArrowDown) { dy += 1; isMoving = true; }
    if (keys.a || keys.ArrowLeft) { dx -= 1; isMoving = true; }
    if (keys.d || keys.ArrowRight) { dx += 1; isMoving = true; }

    // Normalize keyboard vector so diagonal movement isn't faster
    if (isMoving) {
        const length = Math.sqrt(dx * dx + dy * dy);
        dx /= length;
        dy /= length;

        // Apply max speed based on delta time
        player.x += dx * currentMaxSpeed * (deltaTime / 1000);
        player.y += dy * currentMaxSpeed * (deltaTime / 1000);
    }
    // 2. Process Joystick Input (Analog)
    else if (joystick.active) {
        // Calculate speed based on analog pull distance (0 to 1 ratio)
        const speedRatio = Math.min(joystick.distance / joystick.maxDistance, 1.0);
        const currentSpeed = currentMaxSpeed * speedRatio;

        // Apply movement using the joystick's angle
        player.x += Math.cos(joystick.angle) * currentSpeed * (deltaTime / 1000);
        player.y += Math.sin(joystick.angle) * currentSpeed * (deltaTime / 1000);
    }
}

export function drawPlayer(ctx) {
    const { player, camera } = gameState;

    // Calculate player's position on screen relative to the camera
    const screenX = player.x - camera.x;
    const screenY = player.y - camera.y;

    // Draw the player (a 24x24 blue square)
    ctx.fillStyle = '#1e90ff'; // Dodger Blue

    // We draw the player centered on their exact x,y coordinates
    const halfSize = player.size / 2;
    ctx.fillRect(screenX - halfSize, screenY - halfSize, player.size, player.size);

    // Optional: Draw a thin border for better visibility against the green tiles
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(screenX - halfSize, screenY - halfSize, player.size, player.size);
}
