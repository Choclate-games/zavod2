import * as THREE from 'three';
import { VehicleInputState } from '../input/TouchControls';
import { GAME_BALANCE } from '../core/Constants';

export class BotDriver {
  private laneOffset: number;
  private aggression: number;

  constructor(laneOffset: number = 0, aggression: number = 1.0) {
    this.laneOffset = laneOffset;
    this.aggression = aggression;
  }

  computeInput(
    botPos: THREE.Vector3,
    botRot: THREE.Quaternion,
    botSpeedKmh: number,
    trackCurve: THREE.CatmullRomCurve3,
    trackLength: number,
    botTrackProgressT: number,
    distToPlayerM: number
  ): VehicleInputState {
    // 1. Lookahead point along spline
    const lookaheadM = 8.0 + (botSpeedKmh / 200) * 16.0;
    const targetT = (botTrackProgressT + lookaheadM / trackLength) % 1;
    const targetPt = trackCurve.getPointAt(targetT);
    const targetTan = trackCurve.getTangentAt(targetT).normalize();

    // Offset across lane width
    const right = new THREE.Vector3().crossVectors(targetTan, new THREE.Vector3(0, 1, 0)).normalize();
    targetPt.addScaledVector(right, this.laneOffset * 3.5);

    // 2. Relative coordinate to target
    const toTarget = targetPt.clone().sub(botPos).applyQuaternion(botRot.clone().invert());

    let steer = 0;
    if (toTarget.z < 0) {
      steer = Math.max(-1, Math.min(1, -Math.sign(toTarget.x || 1) * 1.0));
    } else {
      steer = Math.max(-1, Math.min(1, -toTarget.x * 0.45));
    }

    // 3. Adaptive Rubberband opposition torque modifier
    // Desired gap = 15.0m
    const desiredGap = 15.0;
    const diff = distToPlayerM - desiredGap;
    const rubberbandMult = 1.0 + Math.max(-0.25, Math.min(0.40, diff * 0.035));

    // 4. Throttle & Brake decisions based on curvature in front
    const curvature = Math.abs(toTarget.x) / Math.max(1, toTarget.z);
    let throttle = 1.0 * rubberbandMult * this.aggression;
    let brake = 0;
    let handbrake = false;

    if (curvature > 0.65 && botSpeedKmh > 110) {
      throttle = 0.4;
      brake = 0.6;
      handbrake = botSpeedKmh > 130;
    } else if (curvature > 0.45 && botSpeedKmh > 150) {
      throttle = 0.7;
      brake = 0.3;
    }

    const wantsNitro = distToPlayerM > 25.0 && Math.random() < 0.05 && botSpeedKmh < 180;

    return {
      steer,
      throttle: Math.min(1, Math.max(0, throttle)),
      brake: Math.min(1, Math.max(0, brake)),
      handbrake,
      nitro: wantsNitro,
    };
  }
}
