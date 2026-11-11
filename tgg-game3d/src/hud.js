import { BLOCKS, HALF } from './city.js';

const SIZE = 168;

export function setupMinimap(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = SIZE * dpr;
  canvas.height = SIZE * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

const toMap = (value) => ((value + HALF) / (HALF * 2)) * SIZE;

export function drawMinimap(ctx, player, target, time, traffic) {
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = 'rgba(5,8,12,0.94)';
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.fillStyle = 'rgba(33,41,52,0.95)';
  const blockSize = (60 / (HALF * 2)) * SIZE;
  for (const block of BLOCKS) {
    ctx.fillRect(toMap(block.x - 30), toMap(block.z - 30), blockSize, blockSize);
  }

  if (traffic) {
    ctx.fillStyle = 'rgba(228,236,247,0.82)';
    for (const car of traffic) {
      if (!car) continue;
      ctx.fillRect(toMap(car.x) - 1.1, toMap(car.z) - 1.1, 2.2, 2.2);
    }
  }

  if (target) {
    const tx = toMap(target.x);
    const ty = toMap(target.z);
    const pulse = 3 + Math.sin(time * 4) * 1.3;
    ctx.beginPath();
    ctx.arc(tx, ty, pulse + 2.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(199,255,0,0.95)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(tx, ty, pulse + 7.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(199,255,0,0.35)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  const px = toMap(player.x);
  const py = toMap(player.z);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(Math.PI - player.heading);
  ctx.beginPath();
  ctx.moveTo(0, -5.2);
  ctx.lineTo(3.7, 4.2);
  ctx.lineTo(-3.7, 4.2);
  ctx.closePath();
  ctx.fillStyle = '#ff3048';
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = 'rgba(199,255,0,0.28)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, SIZE - 1, SIZE - 1);
}
