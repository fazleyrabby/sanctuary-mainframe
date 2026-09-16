export class Grid {
  constructor(
    readonly width: number,
    readonly height: number,
    readonly tileSize: number,
  ) {}

  worldX(gx: number): number {
    return (gx - this.width / 2 + 0.5) * this.tileSize;
  }

  worldZ(gy: number): number {
    return (gy - this.height / 2 + 0.5) * this.tileSize;
  }

  worldToGridX(x: number): number {
    return Math.floor(x / this.tileSize + this.width / 2);
  }

  worldToGridY(z: number): number {
    return Math.floor(z / this.tileSize + this.height / 2);
  }

  inBounds(gx: number, gy: number): boolean {
    return gx >= 0 && gy >= 0 && gx < this.width && gy < this.height;
  }

  index(gx: number, gy: number): number {
    return gy * this.width + gx;
  }

  get halfExtentX(): number {
    return (this.width * this.tileSize) / 2;
  }

  get halfExtentZ(): number {
    return (this.height * this.tileSize) / 2;
  }
}
