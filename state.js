// Singleton game state to prevent global variables
export const gameState = {
    camera: {
        x: 0,
        y: 0
    },
    canvas: {
        width: 0,
        height: 0
    },
    settings: {
        tileSize: 32,
        chunkSize: 16 // 16x16 tiles per chunk
    },
    world: {
        chunks: new Map() // Caches generated chunk data
    },
    keys: {
        w: false,
        a: false,
        s: false,
        d: false,
        ArrowUp: false,
        ArrowLeft: false,
        ArrowDown: false,
        ArrowRight: false
    }
};
