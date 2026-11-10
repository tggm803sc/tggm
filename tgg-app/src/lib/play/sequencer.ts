'use client';

import { useEffect, useRef, useState } from 'react';
import { STEPS, type Pattern } from './types';

const BPM = 92;
const STEP_SECONDS = 60 / BPM / 4;
const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12;

const BASS_NOTES = [
  55, 55, 65.41, 73.42, 55, 55, 82.41, 73.42,
  55, 55, 65.41, 73.42, 82.41, 73.42, 65.41, 55,
];
const LEAD_NOTES = [
  440, 523.25, 659.25, 523.25, 392, 440, 523.25, 659.25,
  440, 523.25, 783.99, 659.25, 523.25, 440, 392, 329.63,
];

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function kick(ctx: AudioContext, out: AudioNode, time: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(140, time);
  osc.frequency.exponentialRampToValueAtTime(46, time + 0.16);
  gain.gain.setValueAtTime(0.9, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.26);
  osc.connect(gain).connect(out);
  osc.start(time);
  osc.stop(time + 0.3);
}

function snare(ctx: AudioContext, out: AudioNode, noise: AudioBuffer, time: number) {
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = noise;
  filter.type = 'bandpass';
  filter.frequency.value = 1800;
  filter.Q.value = 0.9;
  gain.gain.setValueAtTime(0.4, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
  source.connect(filter).connect(gain).connect(out);
  source.start(time);
  source.stop(time + 0.2);
}

function hats(ctx: AudioContext, out: AudioNode, noise: AudioBuffer, time: number) {
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = noise;
  filter.type = 'highpass';
  filter.frequency.value = 7000;
  gain.gain.setValueAtTime(0.16, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
  source.connect(filter).connect(gain).connect(out);
  source.start(time);
  source.stop(time + 0.08);
}

function bass(ctx: AudioContext, out: AudioNode, time: number, frequency: number) {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = frequency;
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  gain.gain.setValueAtTime(0.5, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
  osc.connect(filter).connect(gain).connect(out);
  osc.start(time);
  osc.stop(time + 0.24);
}

function keys(ctx: AudioContext, out: AudioNode, time: number) {
  const chord = [220, 261.63, 329.63];
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.18, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.45);
  gain.connect(out);
  for (const frequency of chord) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    osc.connect(gain);
    osc.start(time);
    osc.stop(time + 0.48);
  }
}

function lead(ctx: AudioContext, out: AudioNode, time: number, frequency: number) {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.value = frequency;
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2400, time);
  filter.frequency.exponentialRampToValueAtTime(700, time + 0.18);
  gain.gain.setValueAtTime(0.16, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
  osc.connect(filter).connect(gain).connect(out);
  osc.start(time);
  osc.stop(time + 0.22);
}

function fx(ctx: AudioContext, out: AudioNode, noise: AudioBuffer, time: number) {
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = noise;
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(600, time);
  filter.frequency.exponentialRampToValueAtTime(4800, time + 0.3);
  gain.gain.setValueAtTime(0.14, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
  source.connect(filter).connect(gain).connect(out);
  source.start(time);
  source.stop(time + 0.32);
}

function playStep(
  ctx: AudioContext,
  out: AudioNode,
  noise: AudioBuffer,
  pattern: Pattern,
  step: number,
  time: number,
) {
  if (pattern.drums[step]) {
    kick(ctx, out, time);
    if (step % 4 === 2) snare(ctx, out, noise, time);
    hats(ctx, out, noise, time);
  }
  if (pattern.bass[step]) bass(ctx, out, time, BASS_NOTES[step]);
  if (pattern.keys[step]) keys(ctx, out, time);
  if (pattern.lead[step]) lead(ctx, out, time, LEAD_NOTES[step]);
  if (pattern.fx[step]) fx(ctx, out, noise, time);
}

/**
 * Schedules the 16-step loop on the Web Audio clock and reports the visible
 * playhead separately. The visual index is derived from the audio context, so
 * the UI never becomes the timing source.
 */
export function useSequencer(pattern: Pattern, playing: boolean): number {
  const [step, setStep] = useState(-1);
  const patternRef = useRef(pattern);
  patternRef.current = pattern;

  useEffect(() => {
    if (!playing) {
      setStep(-1);
      return;
    }
    const Ctor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
    const noise = noiseBuffer(ctx);

    const anchor = ctx.currentTime + 0.08;
    let scheduled = 0;
    const schedule = () => {
      while (anchor + scheduled * STEP_SECONDS < ctx.currentTime + SCHEDULE_AHEAD) {
        playStep(ctx, master, noise, patternRef.current, scheduled % STEPS, anchor + scheduled * STEP_SECONDS);
        scheduled += 1;
      }
    };
    schedule();
    const timer = window.setInterval(schedule, LOOKAHEAD_MS);

    let raf = 0;
    const draw = () => {
      const elapsed = ctx.currentTime - anchor;
      setStep(elapsed < 0 ? 0 : Math.floor(elapsed / STEP_SECONDS) % STEPS);
      raf = window.requestAnimationFrame(draw);
    };
    raf = window.requestAnimationFrame(draw);

    return () => {
      window.clearInterval(timer);
      window.cancelAnimationFrame(raf);
      master.disconnect();
      void ctx.close();
      setStep(-1);
    };
  }, [playing]);

  return step;
}
