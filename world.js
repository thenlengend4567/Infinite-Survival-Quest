import { gameState } from './state.js';

/**
 * Gets a chunk by its coordinates. Generates it if it doesn't exist.
 * For Phase 1, it just returns a uniform chunk of green tiles.
 */
function getChunk(chunkX, chunkY) {
    const chunkKey = `${chunkX},${chunkY}`;

    if (gameState.world.chunks.has(chunkKey)) {
        return gameState.world.chunks.get(chunkKey);
    }

    // Generate a new chunk (16x16 grid of green tiles)
    const size = gameState.settings.chunkSize;
    const tiles = new Array(size * size).fill(1); // 1 represents a green tile

    const chunk = {
        x: chunkX,
        y: chunkY,
        tiles: tiles
    };

    gameState.world.chunks.set(chunkKey, chunk);
    return chunk;
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
            const tile = chunk.tiles[index];

            if (tile === 1) {
                // Determine color slightly based on coordinate to verify chunks and tiles
                // We'll alternate slightly between shades of green
                const globalX = chunk.x * chunkSize + x;
                const globalY = chunk.y * chunkSize + y;

                // Add a small checkerboard pattern to visualize tiles
                const isAlternate = (globalX + globalY) % 2 === 0;
                ctx.fillStyle = isAlternate ? '#2e8b57' : '#3cb371'; // SeaGreen vs MediumSeaGreen

                // Screen coordinates for rendering
                const screenX = offsetX + (x * tileSize) - camera.x;
                const screenY = offsetY + (y * tileSize) - camera.y;

                ctx.fillRect(screenX, screenY, tileSize, tileSize);
            }
        }
    }
}
