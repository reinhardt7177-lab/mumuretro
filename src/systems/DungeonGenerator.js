// BSP(Binary Space Partitioning) 기반 절차적 던전 생성
export const TILE = {
  WALL: 0,
  FLOOR: 1,
  DOOR: 2,
  STAIRS_DOWN: 3,
  VOID: 4,
};

export class DungeonGenerator {
  constructor(width, height, minRoomSize = 6, maxRoomSize = 14) {
    this.width = width;
    this.height = height;
    this.minRoomSize = minRoomSize;
    this.maxRoomSize = maxRoomSize;
    this.rooms = [];
    this.grid = [];
  }

  generate() {
    this.grid = Array.from({ length: this.height }, () =>
      Array(this.width).fill(TILE.WALL)
    );
    this.rooms = [];

    const root = { x: 1, y: 1, w: this.width - 2, h: this.height - 2 };
    const leaves = this._splitBSP(root, 0);

    leaves.forEach(leaf => {
      const room = this._createRoom(leaf);
      if (room) {
        this._carveRoom(room);
        this.rooms.push(room);
      }
    });

    // 방들을 연결하는 복도
    for (let i = 1; i < this.rooms.length; i++) {
      this._connectRooms(this.rooms[i - 1], this.rooms[i]);
    }

    // 계단 배치 (마지막 방)
    const lastRoom = this.rooms[this.rooms.length - 1];
    const stairX = lastRoom.x + Math.floor(lastRoom.w / 2);
    const stairY = lastRoom.y + Math.floor(lastRoom.h / 2);
    this.grid[stairY][stairX] = TILE.STAIRS_DOWN;
    this.stairsPos = { x: stairX, y: stairY };

    return this;
  }

  _splitBSP(node, depth) {
    const minSize = this.minRoomSize + 2;
    if (depth > 5 || (node.w < minSize * 2 && node.h < minSize * 2)) {
      return [node];
    }

    const splitH = node.h > node.w;
    let leaves = [];

    if (splitH && node.h >= minSize * 2) {
      const splitAt = minSize + Math.floor(Math.random() * (node.h - minSize * 2));
      const a = { x: node.x, y: node.y, w: node.w, h: splitAt };
      const b = { x: node.x, y: node.y + splitAt, w: node.w, h: node.h - splitAt };
      leaves = [...this._splitBSP(a, depth + 1), ...this._splitBSP(b, depth + 1)];
    } else if (!splitH && node.w >= minSize * 2) {
      const splitAt = minSize + Math.floor(Math.random() * (node.w - minSize * 2));
      const a = { x: node.x, y: node.y, w: splitAt, h: node.h };
      const b = { x: node.x + splitAt, y: node.y, w: node.w - splitAt, h: node.h };
      leaves = [...this._splitBSP(a, depth + 1), ...this._splitBSP(b, depth + 1)];
    } else {
      return [node];
    }

    return leaves;
  }

  _createRoom(leaf) {
    const maxW = Math.min(this.maxRoomSize, leaf.w - 2);
    const maxH = Math.min(this.maxRoomSize, leaf.h - 2);
    if (maxW < this.minRoomSize || maxH < this.minRoomSize) return null;

    const w = this.minRoomSize + Math.floor(Math.random() * (maxW - this.minRoomSize + 1));
    const h = this.minRoomSize + Math.floor(Math.random() * (maxH - this.minRoomSize + 1));
    const x = leaf.x + 1 + Math.floor(Math.random() * (leaf.w - w - 1));
    const y = leaf.y + 1 + Math.floor(Math.random() * (leaf.h - h - 1));

    return { x, y, w, h };
  }

  _carveRoom(room) {
    for (let row = room.y; row < room.y + room.h; row++) {
      for (let col = room.x; col < room.x + room.w; col++) {
        this.grid[row][col] = TILE.FLOOR;
      }
    }
  }

  _connectRooms(a, b) {
    const ax = Math.floor(a.x + a.w / 2);
    const ay = Math.floor(a.y + a.h / 2);
    const bx = Math.floor(b.x + b.w / 2);
    const by = Math.floor(b.y + b.h / 2);

    // L자 복도
    if (Math.random() < 0.5) {
      this._carveHCorridor(ax, bx, ay);
      this._carveVCorridor(ay, by, bx);
    } else {
      this._carveVCorridor(ay, by, ax);
      this._carveHCorridor(ax, bx, by);
    }
  }

  _carveHCorridor(x1, x2, y) {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
      if (y > 0 && y < this.height - 1) this.grid[y][x] = TILE.FLOOR;
    }
  }

  _carveVCorridor(y1, y2, x) {
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
      if (x > 0 && x < this.width - 1) this.grid[y][x] = TILE.FLOOR;
    }
  }

  getPlayerStart() {
    const first = this.rooms[0];
    return {
      x: Math.floor(first.x + first.w / 2),
      y: Math.floor(first.y + first.h / 2),
    };
  }

  getMonsterSpawns(count) {
    const spawns = [];
    const usable = this.rooms.slice(1); // 첫 방 제외
    for (let i = 0; i < count && i < usable.length; i++) {
      const r = usable[i];
      spawns.push({
        x: r.x + 1 + Math.floor(Math.random() * (r.w - 2)),
        y: r.y + 1 + Math.floor(Math.random() * (r.h - 2)),
      });
    }
    return spawns;
  }

  isWalkable(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return false;
    return this.grid[ty][tx] !== TILE.WALL && this.grid[ty][tx] !== TILE.VOID;
  }
}
