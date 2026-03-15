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
    player: {
        x: 0,
        y: 0,
        size: 24, // Slightly smaller than a 32x32 tile
        speed: 200 // Max pixels per second
    },
    ui: {
        joystick: {
            active: false,
            originX: 0,
            originY: 0,
            currentX: 0,
            currentY: 0,
            distance: 0, // Current analog distance from origin
            maxDistance: 50, // Max distance for full speed
            angle: 0
        }
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
