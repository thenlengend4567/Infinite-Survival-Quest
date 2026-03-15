import { gameState } from './state.js';
import { getTileAtWorldPos, getEntityAtWorldPos } from './world.js';

/**
 * Checks AABB collision against resources grid (max 1 per tile).
 * Returns the entity object if colliding, otherwise null.
 */
function checkEntityCollision(targetX, targetY) {
    const { size } = gameState.player;
    const halfSize = size / 2;
    const { tileSize } = gameState.settings;

    // Resource collision box is slightly smaller than the full 32x32 tile (~80%)
    const colSize = tileSize * 0.8;
    const halfColSize = colSize / 2;

    // Check corners of player bounding box for grid entities
    const corners = [
        { x: targetX - halfSize, y: targetY - halfSize },
        { x: targetX + halfSize, y: targetY - halfSize },
        { x: targetX - halfSize, y: targetY + halfSize },
        { x: targetX + halfSize, y: targetY + halfSize }
    ];

    for (let point of corners) {
        const result = getEntityAtWorldPos(point.x, point.y);
        if (result) {
            // Verify strict AABB collision against the tile's smaller collision box
            // The tile center world coordinates
            const chunkPixelSize = tileSize * gameState.settings.chunkSize;
            const tileCenterX = (result.chunk.x * chunkPixelSize) + (result.entity.localX * tileSize) + (tileSize / 2);
            const tileCenterY = (result.chunk.y * chunkPixelSize) + (result.entity.localY * tileSize) + (tileSize / 2);

            const isColliding =
                targetX - halfSize < tileCenterX + halfColSize &&
                targetX + halfSize > tileCenterX - halfColSize &&
                targetY - halfSize < tileCenterY + halfColSize &&
                targetY + halfSize > tileCenterY - halfColSize;

            if (isColliding) return result;
        }
    }
    return null;
}

export function updatePlayer(deltaTime) {
    const { player, keys, ui } = gameState;
    const { joystick } = ui;

    // --- Survival Core Loop ---

    // Eating Berries (debounce simple by checking key press or button state)
    // We only process if they pressed 'f' and it wasn't processed last frame (need simple toggle or cooldown)
    if (keys.f && player.inventory.berries > 0 && player.stats.hunger < 100) {
        player.inventory.berries--;
        player.stats.hunger = Math.min(100, player.stats.hunger + 20);
        keys.f = false; // "Consume" the keypress so it doesn't drain instantly
    }

    // Hunger Logic
    player.timers.hunger += deltaTime;
    if (player.timers.hunger >= 3000) {
        player.stats.hunger -= 1;
        player.timers.hunger = 0;
    }

    // Starvation Logic
    if (player.stats.hunger <= 0) {
        player.stats.hunger = 0;
        player.timers.starvation += deltaTime;
        if (player.timers.starvation >= 2000) {
            player.stats.health -= 5;
            player.timers.starvation = 0;
        }
    } else {
        player.timers.starvation = 0; // Reset starvation timer if player eats
    }

    // --- Terrain & Physics ---

    // Determine current terrain to apply physics/speed penalties
    const currentTileId = getTileAtWorldPos(player.x, player.y);
    let speedModifier = 1.0;

    // Water Logic & Drowning
    if (currentTileId === 0) { // Water Tile ID is 0
        speedModifier = 0.5; // Cut speed in half

        // Drowning timer
        player.timers.water += deltaTime;
        if (player.timers.water >= 5000) { // After 5 seconds
            player.stats.health -= 10 * (deltaTime / 1000); // 10% per second
        }
    } else {
        // Instantly reset drowning timer on land
        player.timers.water = 0;
    }

    const currentMaxSpeed = player.speed * speedModifier;

    // Check Death Condition
    if (player.stats.health <= 0) {
        player.stats.health = 0;
        ui.gameOver = true;
        return; // Stop updating movement
    }

    // Movement vector
    let dx = 0;
    let dy = 0;
    let isMoving = false;

    // 1. Process Keyboard Input (Digital)
    if (keys.w || keys.ArrowUp) { dy -= 1; isMoving = true; }
    if (keys.s || keys.ArrowDown) { dy += 1; isMoving = true; }
    if (keys.a || keys.ArrowLeft) { dx -= 1; isMoving = true; }
    if (keys.d || keys.ArrowRight) { dx += 1; isMoving = true; }

    // Calculate intended movement delta
    let deltaX = 0;
    let deltaY = 0;

    // Normalize keyboard vector so diagonal movement isn't faster
    if (isMoving) {
        const length = Math.sqrt(dx * dx + dy * dy);

        if (length > 0) {
            dx /= length;
            dy /= length;

            deltaX = dx * currentMaxSpeed * (deltaTime / 1000);
            deltaY = dy * currentMaxSpeed * (deltaTime / 1000);
        } else {
            isMoving = false; // Canceling keys (e.g. W and S) pressed simultaneously
        }
    }
    // 2. Process Joystick Input (Analog)
    else if (joystick.active) {
        const speedRatio = Math.min(joystick.distance / joystick.maxDistance, 1.0);
        const currentSpeed = currentMaxSpeed * speedRatio;

        deltaX = Math.cos(joystick.angle) * currentSpeed * (deltaTime / 1000);
        deltaY = Math.sin(joystick.angle) * currentSpeed * (deltaTime / 1000);
        isMoving = true;
    }

    let collidedEntity = null;

    // Store original position to revert if we slide while mining
    const startX = player.x;
    const startY = player.y;

    if (isMoving) {
        // Resolve X Collision
        if (deltaX !== 0) {
            const colX = checkEntityCollision(player.x + deltaX, player.y);
            if (!colX || colX.entity.type === 'bush') {
                player.x += deltaX;
                if (colX && colX.entity.type === 'bush') collidedEntity = colX;
            } else {
                collidedEntity = colX;
            }
        }

        // Resolve Y Collision
        if (deltaY !== 0) {
            const colY = checkEntityCollision(player.x, player.y + deltaY);
            if (!colY || colY.entity.type === 'bush') {
                player.y += deltaY;
                if (colY && colY.entity.type === 'bush') collidedEntity = colY;
            } else {
                collidedEntity = colY;
            }
        }
    }

    // Mining Stability Feature:
    // If we collided with something we are actively gathering (from last frame),
    // we want to lock the player's movement so they don't slide off.
    // By reverting their coordinates to what they were before the delta if they are gathering.
    // Actually, setting deltaX/Y to 0 earlier is hard because we need the delta to check collision.
    // Let's just lock position if they hit the SAME target they are gathering.
    // We can do this cleanly by removing the delta we just added if it's the same target.

    // Since we only added deltaX/Y if there was NO collision, the sliding happens because
    // one axis collided and the OTHER axis didn't.
    // If they hit something, `collidedEntity` is populated. Let's check if it's the gathering target.
    if (collidedEntity && player.gathering.targetId === collidedEntity.entity.id) {
        // They slid. Revert position completely to lock them while mining.
        player.x = startX;
        player.y = startY;
    }

    // Gathering Logic
    if (collidedEntity) {
        const entityType = collidedEntity.entity.type;
        const entityId = collidedEntity.entity.id;

        // Instant harvest for bushes
        if (entityType === 'bush') {
            player.inventory.berries++;
            collidedEntity.chunk.entities.delete(collidedEntity.index);
            gameState.world.destroyedEntities.add(entityId);

            // Do not start gathering timer for bushes
            player.gathering.targetId = null;
            player.gathering.timer = 0;
        } else {
            // Determine required time based on tools
            player.gathering.currentRequiredTime = player.gathering.requiredTime;
            if (entityType === 'tree' && player.tools.axe) {
                player.gathering.currentRequiredTime = 500;
            } else if (entityType === 'rock' && player.tools.pickaxe) {
                player.gathering.currentRequiredTime = 500;
            }

            if (player.gathering.targetId === entityId) {
                player.gathering.timer += deltaTime;
                if (player.gathering.timer >= player.gathering.currentRequiredTime) {
                    // Harvest complete
                    if (entityType === 'tree') player.inventory.wood++;
                    if (entityType === 'rock') player.inventory.stone++;

                    // Remove entity from chunk and add to persistence set
                    collidedEntity.chunk.entities.delete(collidedEntity.index);
                    gameState.world.destroyedEntities.add(entityId);

                    player.gathering.targetId = null;
                    player.gathering.timer = 0;
                }
            } else {
                // Started pushing against a new entity
                player.gathering.targetId = entityId;
                player.gathering.timer = 0;
            }
        }
    } else {
        // Reset timer if not pushing against anything
        player.gathering.targetId = null;
        player.gathering.timer = 0;
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

    // Draw Gathering Progress Bar if active
    if (player.gathering.targetId && player.gathering.timer > 0) {
        // Use the dynamically calculated required time
        const progress = Math.min(player.gathering.timer / player.gathering.currentRequiredTime, 1.0);

        const barWidth = 30;
        const barHeight = 6;

        // Background
        ctx.fillStyle = '#000000';
        ctx.fillRect(screenX - barWidth / 2, screenY - halfSize - 12, barWidth, barHeight);

        // Progress
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(screenX - barWidth / 2 + 1, screenY - halfSize - 11, (barWidth - 2) * progress, barHeight - 2);
    }
}
