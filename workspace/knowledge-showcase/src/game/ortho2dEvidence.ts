/**
 * Orthographic 2D, Swipe Slicer & Evidence Board Deduction Graph logic.
 * Pure TS, independent of Three.js.
 * Implements knowledge/threejs/orthographic_2d_and_pointer_input.md and
 * knowledge/mechanics/evidence_board.md.
 */

export const WORLD_HEIGHT = 20.0;

export interface OrthoBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  halfW: number;
  halfH: number;
}

export function computeOrthoBounds(screenWidth: number, screenHeight: number, worldHeight = WORLD_HEIGHT): OrthoBounds {
  const aspect = screenWidth / Math.max(1, screenHeight);
  const halfH = worldHeight / 2;
  const halfW = halfH * aspect;
  return {
    left: -halfW,
    right: halfW,
    top: halfH,
    bottom: -halfH,
    halfW,
    halfH,
  };
}

export interface Vec2D {
  x: number;
  y: number;
}

/**
 * Checks if line segment AB intersects circle with center C and radius R.
 * Uses closest point projection clamped to [0, 1].
 */
export function segmentHitsCircle(
  ax: number, ay: number,
  bx: number, by: number,
  cx: number, cy: number,
  r: number,
): boolean {
  const abx = bx - ax;
  const aby = by - ay;
  const abLenSq = abx * abx + aby * aby;

  if (abLenSq === 0) {
    const dSq = (cx - ax) * (cx - ax) + (cy - ay) * (cy - ay);
    return dSq <= r * r;
  }

  const acx = cx - ax;
  const acy = cy - ay;
  const dot = acx * abx + acy * aby;
  const t = Math.max(0, Math.min(1, dot / abLenSq));

  const projX = ax + abx * t;
  const projY = ay + aby * t;

  const distSq = (cx - projX) * (cx - projX) + (cy - projY) * (cy - projY);
  return distSq <= r * r;
}

/**
 * Evaluates a quadratic bezier curve at parameter t in [0, 1].
 * B(t) = (1-t)^2 * P0 + 2*(1-t)*t * P1 + t^2 * P2
 */
export function evaluateQuadraticBezier(
  p0: Vec2D, p1: Vec2D, p2: Vec2D, t: number,
): Vec2D {
  const invT = 1 - t;
  return {
    x: invT * invT * p0.x + 2 * invT * t * p1.x + t * t * p2.x,
    y: invT * invT * p0.y + 2 * invT * t * p1.y + t * t * p2.y,
  };
}

export interface ClueNode {
  id: string;
  title: string;
  category: 'evidence' | 'suspect' | 'location' | 'weapon';
  x: number;
  y: number;
  isUnlocked: boolean;
}

export interface EvidenceLink {
  id: string;
  fromId: string;
  toId: string;
  isValid: boolean;
}

export class EvidenceGraphSystem {
  public clues: Map<string, ClueNode> = new Map();
  public links: EvidenceLink[] = [];
  public detectiveFocus = 100;
  public deductionsFound = 0;
  public totalValidDeductions = 0;

  // Truth table: pairs of valid clue links
  private truthTable: Set<string> = new Set();

  constructor() {
    this.setupCaseScenario();
  }

  private setupCaseScenario(): void {
    const nodes: ClueNode[] = [
      { id: 'muddy_footprints', title: 'Грязные следы 43 размера', category: 'evidence', x: -6, y: 5, isUnlocked: true },
      { id: 'broken_window', title: 'Разбитое окно кабинета', category: 'location', x: -6, y: -4, isUnlocked: true },
      { id: 'torn_black_fabric', title: 'Обрывок черной ткани', category: 'evidence', x: 0, y: 6, isUnlocked: true },
      { id: 'suspect_gardener', title: 'Садовник (грязные сапоги)', category: 'suspect', x: 6, y: 5, isUnlocked: true },
      { id: 'suspect_butler', title: 'Дворецкий (черный фрак с дырой)', category: 'suspect', x: 6, y: -4, isUnlocked: true },
      { id: 'crowbar_weapon', title: 'Окровавленный лом', category: 'weapon', x: 0, y: -5, isUnlocked: true },
    ];

    for (const n of nodes) {
      this.clues.set(n.id, n);
    }

    // Valid deductive connections
    this.addValidPair('muddy_footprints', 'suspect_gardener');
    this.addValidPair('torn_black_fabric', 'suspect_butler');
    this.addValidPair('broken_window', 'crowbar_weapon');
    this.totalValidDeductions = this.truthTable.size;
  }

  private pairKey(a: string, b: string): string {
    return a < b ? `${a}---${b}` : `${b}---${a}`;
  }

  private addValidPair(a: string, b: string): void {
    this.truthTable.add(this.pairKey(a, b));
  }

  public connectClues(fromId: string, toId: string): { success: boolean; isValid: boolean; message: string } {
    if (fromId === toId) return { success: false, isValid: false, message: 'Нельзя соединить улику с самой собой' };
    if (!this.clues.has(fromId) || !this.clues.has(toId)) return { success: false, isValid: false, message: 'Улика не найдена' };

    const key = this.pairKey(fromId, toId);
    if (this.links.some((l) => this.pairKey(l.fromId, l.toId) === key)) {
      return { success: false, isValid: false, message: 'Связь уже установлена' };
    }

    const isValid = this.truthTable.has(key);
    this.links.push({
      id: key,
      fromId,
      toId,
      isValid,
    });

    if (isValid) {
      this.deductionsFound++;
      return { success: true, isValid: true, message: 'Верная дедуктивная связь найдена!' };
    } else {
      this.detectiveFocus = Math.max(0, this.detectiveFocus - 25);
      return { success: true, isValid: false, message: 'Ложная зацепка: нить оборвана, потеряно внимание (-25)' };
    }
  }

  public removeLink(linkId: string): void {
    const idx = this.links.findIndex((l) => l.id === linkId);
    if (idx !== -1) {
      if (this.links[idx].isValid) {
        this.deductionsFound--;
      }
      this.links.splice(idx, 1);
    }
  }

  public reset(): void {
    this.links = [];
    this.detectiveFocus = 100;
    this.deductionsFound = 0;
  }
}
