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

    // Calculate intended movement delta
    let deltaX = 0;
    let deltaY = 0;

    // Normalize keyboard vector so diagonal movement isn't faster
    if (isMoving) {
        const length = Math.sqrt(dx * dx + dy * dy);
        dx /= length;
        dy /= length;

        deltaX = dx * currentMaxSpeed * (deltaTime / 1000);
        deltaY = dy * currentMaxSpeed * (deltaTime / 1000);
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

    if (isMoving) {
        // Resolve X Collision
        if (deltaX !== 0) {
            const colX = checkEntityCollision(player.x + deltaX, player.y);
            if (!colX) {
                player.x += deltaX;
            } else {
                collidedEntity = colX;
            }
        }

        // Resolve Y Collision
        if (deltaY !== 0) {
            const colY = checkEntityCollision(player.x, player.y + deltaY);
            if (!colY) {
                player.y += deltaY;
            } else {
                collidedEntity = colY;
            }
        }
    }

    // Gathering Logic
    if (collidedEntity) {
        const entityId = collidedEntity.entity.id;

        if (player.gathering.targetId === entityId) {
            player.gathering.timer += deltaTime;
            if (player.gathering.timer >= player.gathering.requiredTime) {
                // Harvest complete
                if (collidedEntity.entity.type === 'tree') player.inventory.wood++;
                if (collidedEntity.entity.type === 'rock') player.inventory.stone++;

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
        const barWidth = 30;
        const barHeight = 6;
        const progress = Math.min(player.gathering.timer / player.gathering.requiredTime, 1.0);

        // Background
        ctx.fillStyle = '#000000';
        ctx.fillRect(screenX - barWidth / 2, screenY - halfSize - 12, barWidth, barHeight);

        // Progress
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(screenX - barWidth / 2 + 1, screenY - halfSize - 11, (barWidth - 2) * progress, barHeight - 2);
    }
}
