import { gameState } from './state.js';

// --- Lightweight 2D Value Noise Implementation ---
// Fixed seed for consistent world generation (can be modified later)
const SEED = 42;

// Simple random function based on coordinates
function random(x, y) {
    const dot = (x + SEED) * 12.9898 + (y + SEED) * 78.233;
    const sine = Math.sin(dot) * 43758.5453123;
    return sine - Math.floor(sine);
}

// Smooth interpolation between two values
function lerp(a, b, t) {
    return a + t * (b - a);
}

// Smoothstep for softer transitions
function smoothstep(t) {
    return t * t * (3.0 - 2.0 * t);
}

// 2D Value Noise
function noise(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;

    // Get random values for the 4 corners of the cell
    const a = random(ix, iy);
    const b = random(ix + 1, iy);
    const c = random(ix, iy + 1);
    const d = random(ix + 1, iy + 1);

    // Smooth the fractional coordinates
    const sx = smoothstep(fx);
    const sy = smoothstep(fy);

    // Interpolate along x, then y
    const nx0 = lerp(a, b, sx);
    const nx1 = lerp(c, d, sx);
    return lerp(nx0, nx1, sy);
}

// Combine multiple octaves of noise for more natural terrain
function fbm(x, y, octaves = 3) {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1.0;

    for (let i = 0; i < octaves; i++) {
        value += noise(x * frequency, y * frequency) * amplitude;
        amplitude *= 0.5;
        frequency *= 2.0;
    }

    // Normalize roughly to 0.0 - 1.0 range based on initial amplitude sum
    return value;
}
// -------------------------------------------------

/**
 * Gets a chunk by its coordinates. Generates it if it doesn't exist using noise.
 */
function getChunk(chunkX, chunkY) {
    const chunkKey = `${chunkX},${chunkY}`;

    if (gameState.world.chunks.has(chunkKey)) {
        return gameState.world.chunks.get(chunkKey);
    }

    const size = gameState.settings.chunkSize;
    const tiles = new Array(size * size);
    const entities = new Map(); // local tile index -> entity object

    // Noise scale: Smaller number = larger features.
    // We want features 2-4 chunks wide.
    // 1 chunk is 16 tiles. So 2-4 chunks is 32-64 tiles.
    const noiseScale = 0.03;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            // Global tile coordinates
            const globalX = (chunkX * size) + x;
            const globalY = (chunkY * size) + y;

            // Generate noise value between ~0.0 and 1.0
            const elevation = fbm(globalX * noiseScale, globalY * noiseScale, 3);

            // Determine Biome based on Elevation
            let tileId = 2; // Default Grass

            if (elevation < 0.3) {
                tileId = 0; // Water
            } else if (elevation < 0.4) {
                tileId = 1; // Sand
            } else if (elevation < 0.7) {
                tileId = 2; // Grass
            } else {
                tileId = 3; // Forest
            }

            const index = y * size + x;
            tiles[index] = tileId;

            // Spawn Entities (Trees in Forest, Rocks in Grass)
            const entityId = `${chunkX}_${chunkY}_${x}_${y}`;
            if (!gameState.world.destroyedEntities.has(entityId)) {
                // Use random function with a slight offset to ensure it's deterministic but decoupled from elevation
                const entityRand = Math.abs(random(globalX + 1000, globalY + 1000));

                if (tileId === 3 && entityRand < 0.15) { // 15% chance for a tree in a forest tile
                    entities.set(index, { type: 'tree', id: entityId, localX: x, localY: y });
                } else if (tileId === 2 && entityRand < 0.05) { // 5% chance for a rock in a grass tile
                    entities.set(index, { type: 'rock', id: entityId, localX: x, localY: y });
                }
            }
        }
    }

    const chunk = {
        x: chunkX,
        y: chunkY,
        tiles: tiles,
        entities: entities // Map of tileIndex -> entity
    };

    gameState.world.chunks.set(chunkKey, chunk);
    return chunk;
}

/**
 * Helper to get the Tile ID at a specific global pixel coordinate.
 */
export function getTileAtWorldPos(worldX, worldY) {
    const { tileSize, chunkSize } = gameState.settings;

    // Pixel dimensions of a single chunk
    const chunkPixelSize = tileSize * chunkSize;

    // Calculate which chunk this coordinate falls into
    const chunkX = Math.floor(worldX / chunkPixelSize);
    const chunkY = Math.floor(worldY / chunkPixelSize);

    const chunk = getChunk(chunkX, chunkY);

    // Calculate local tile coordinates within the chunk
    // Ensure we handle negative coordinates correctly by using modulo arithmetic
    let localX = Math.floor((worldX % chunkPixelSize) / tileSize);
    let localY = Math.floor((worldY % chunkPixelSize) / tileSize);

    if (localX < 0) localX += chunkSize;
    if (localY < 0) localY += chunkSize;

    const index = localY * chunkSize + localX;
    return chunk.tiles[index];
}

/**
 * Helper to get the Entity object at a specific global pixel coordinate (if one exists).
 */
export function getEntityAtWorldPos(worldX, worldY) {
    const { tileSize, chunkSize } = gameState.settings;

    const chunkPixelSize = tileSize * chunkSize;

    const chunkX = Math.floor(worldX / chunkPixelSize);
    const chunkY = Math.floor(worldY / chunkPixelSize);

    const chunk = getChunk(chunkX, chunkY);

    let localX = Math.floor((worldX % chunkPixelSize) / tileSize);
    let localY = Math.floor((worldY % chunkPixelSize) / tileSize);

    if (localX < 0) localX += chunkSize;
    if (localY < 0) localY += chunkSize;

    const index = localY * chunkSize + localX;
    return chunk.entities.has(index) ? { entity: chunk.entities.get(index), index, chunk } : null;
}

/**
 * Draws the visible world based on the camera position.
 * Only chunks that intersect with the screen are drawn.
 */
export function drawWorld(ctx) {
    const { camera, canvas, settings } = gameState;
    const { tileSize, chunkSize } = settings;

    // Pixel dimensions of a single chunk
    const chunkPixelSize = tileSize * chunkSize;

    // Determine the visible area in world coordinates
    const startX = camera.x;
    const startY = camera.y;
    const endX = startX + canvas.width;
    const endY = startY + canvas.height;

    // Determine which chunks are visible
    const startChunkX = Math.floor(startX / chunkPixelSize);
    const startChunkY = Math.floor(startY / chunkPixelSize);
    const endChunkX = Math.floor(endX / chunkPixelSize);
    const endChunkY = Math.floor(endY / chunkPixelSize);

    // Loop through all visible chunks
    for (let cy = startChunkY; cy <= endChunkY; cy++) {
        for (let cx = startChunkX; cx <= endChunkX; cx++) {
            const chunk = getChunk(cx, cy);
            drawChunk(ctx, chunk);
        }
    }

    // Call garbage collection occasionally based on center chunk
    const centerChunkX = Math.floor((camera.x + canvas.width / 2) / chunkPixelSize);
    const centerChunkY = Math.floor((camera.y + canvas.height / 2) / chunkPixelSize);
    cleanupChunks(centerChunkX, centerChunkY);
}

/**
 * Removes chunks that are too far away to prevent memory leaks.
 */
function cleanupChunks(centerChunkX, centerChunkY) {
    const maxDistance = 2; // Render distance is approx 1-2 chunks, keep 1 extra border

    for (const [key, chunk] of gameState.world.chunks.entries()) {
        const dist = Math.max(Math.abs(chunk.x - centerChunkX), Math.abs(chunk.y - centerChunkY));
        if (dist > maxDistance) {
            gameState.world.chunks.delete(key);
        }
    }
}

/**
 * Helper function to draw a single chunk.
 */
function drawChunk(ctx, chunk) {
    const { camera, settings } = gameState;
    const { tileSize, chunkSize } = settings;

    // Pixel offset of this chunk in the world
    const offsetX = chunk.x * chunkSize * tileSize;
    const offsetY = chunk.y * chunkSize * tileSize;

    for (let y = 0; y < chunkSize; y++) {
        for (let x = 0; x < chunkSize; x++) {
            const index = y * chunkSize + x;
            const tileId = chunk.tiles[index];

            // Map Tile ID to color
            let color = '#000000'; // fallback
            switch(tileId) {
                case 0: color = '#1E90FF'; break; // Water
                case 1: color = '#F4A460'; break; // Sand
                case 2: color = '#3CB371'; break; // Grass
                case 3: color = '#228B22'; break; // Forest
            }

            ctx.fillStyle = color;

            // Screen coordinates for rendering
            const screenX = offsetX + (x * tileSize) - camera.x;
            const screenY = offsetY + (y * tileSize) - camera.y;

            // Draw tile with a tiny fractional overlap to prevent rendering gaps
            ctx.fillRect(screenX, screenY, tileSize + 0.5, tileSize + 0.5);

            // Draw Entity if it exists on this tile
            if (chunk.entities.has(index)) {
                const entity = chunk.entities.get(index);
                const centerX = screenX + tileSize / 2;
                const centerY = screenY + tileSize / 2;

                if (entity.type === 'tree') {
                    ctx.beginPath();
                    ctx.arc(centerX, centerY, 14, 0, Math.PI * 2); // 28x28 circle
                    ctx.fillStyle = '#5C4033'; // Dark Brown
                    ctx.fill();

                    // Optional outline
                    ctx.strokeStyle = '#3E2723';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                } else if (entity.type === 'rock') {
                    ctx.fillStyle = '#696969'; // Dim Gray
                    ctx.fillRect(centerX - 10, centerY - 10, 20, 20); // 20x20 square

                    // Optional outline
                    ctx.strokeStyle = '#4A4A4A';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(centerX - 10, centerY - 10, 20, 20);
                }
            }
        }
    }
}
