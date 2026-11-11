// Studio 808 production panel: five tracks of sixteen step pads, real transport
// controls, a performance pass and the take review. Audio is synthesised by
// EngineAudio; this file only decides what to play and when.
import {
  STARTER_STEPS,
  STEPS,
  TRACKS,
  arrangementScore,
  assessMaster,
  blendTake,
  clearPattern,
  countSteps,
  createPattern,
  normalizePattern,
  setBpm,
  setLoop,
  setVolume,
  toggleMute,
  toggleStep,
  totalHits,
  verdictFor,
} from './sequencer.js';

const el = (id) => document.getElementById(id);

function h(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child == null) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function initProducer({ audio, session, getProduction, onProduction, onMastered, onToast }) {
  const sheet = el('producer');
  const body = el('producerBody');
  const closeButton = el('producerClose');

  let pattern = createPattern();
  let take = null;
  let captures = 0;
  let mode = 'beat';
  // 'studio' is the Act I desk; 'maya' is her B room and its own thread.
  let variant = 'studio';
  let playing = false;
  let taps = 0;
  let clearing = false;
  let clearTimer = null;
  let mastered = false;
  let takeUrl = null;
  let recording = false;
  let playback = null;
  const pads = new Map();

  const currentProduction = () => ({ pattern, take, captures });

  function save() {
    onProduction?.(currentProduction());
  }

  function persistSoon() {
    save();
  }

  // ---- transport -----------------------------------------------------------

  function startPlayback() {
    // The tap that starts the beat is the gesture that unlocks the context.
    audio.unlock();
    audio.startSequencer(pattern, highlight);
    playing = true;
  }

  function stopPlayback() {
    audio.stopSequencer();
    playing = false;
    highlight(-1);
  }

  function togglePlayback() {
    if (playing) {
      stopPlayback();
    } else {
      // Some browsers refuse the first context outright (an embedded preview, a
      // strict autoplay policy). Say so instead of looking broken.
      const ready = audio.unlock();
      startPlayback();
      if (!ready) onToast?.('Tap Play again to allow sound');
    }
    render();
  }

  function highlight(index) {
    for (const list of pads.values()) {
      list.forEach((pad, step) => {
        if (step === index) pad.setAttribute('data-playing', '1');
        else pad.removeAttribute('data-playing');
      });
    }
  }

  // ---- capture -------------------------------------------------------------

  function startCapture() {
    mode = 'capture';
    taps = 0;
    session.start();
    if (!playing) startPlayback();
    // Record the beat and the performance together: this is the take.
    recording = audio.startRecording();
    render();
  }

  function tap() {
    if (mode !== 'capture') return;
    const result = session.tap();
    audio.hitTone(result?.score ?? 0);
    taps += 1;
    if (session.scores.length >= 1) finishCapture();
    else renderCaptureProgress();
  }

  function finishCapture() {
    // A burst of taps inside one frame is refused outright, so the gate cannot
    // be beaten by hammering the pad.
    const burst = Boolean(session.burst);
    const timing = burst ? 0 : session.scores[0] ?? 0;
    session.abort?.();
    stopPlayback();
    const arrangement = arrangementScore(pattern);
    const quality = burst ? 0 : blendTake(arrangement, timing);
    const verdict = burst
      ? {
          accepted: false,
          quality: 0,
          line: 'Engineer: that was a burst of taps, not a performance. Play it again in time.',
        }
      : verdictFor(quality, { arrangement, timing });
    take = {
      accepted: verdict.accepted,
      quality,
      timing,
      arrangement,
      bpm: pattern.bpm,
      at: Date.now(),
      burst,
    };
    captures += 1;
    mastered = false;
    mode = 'review';
    if (recording) {
      recording = false;
      audio.stopRecording().then((url) => {
        if (!url) return;
        if (takeUrl) URL.revokeObjectURL(takeUrl);
        takeUrl = url;
        if (mode === 'review') render();
      });
    }
    save();
    render();
  }

  // ---- views ---------------------------------------------------------------

  function actionButton(label, action, extra = {}) {
    return h('button', { class: `sheet-btn ${extra.class ?? ''}`.trim(), type: 'button', 'data-act': action, text: label });
  }

  function renderTransport() {
    const arrangement = arrangementScore(pattern);
    return h('div', { class: 'producer-transport' }, [
      actionButton(playing ? 'Stop' : 'Play', 'play', { class: 'primary' }),
      h('div', { class: 'bpm-control' }, [
        h('button', { class: 'bpm-step', type: 'button', 'data-act': 'bpm-down', text: '−', 'aria-label': 'Slower' }),
        h('span', { class: 'bpm-value', id: 'bpmValue', text: `${pattern.bpm} BPM` }),
        h('button', { class: 'bpm-step', type: 'button', 'data-act': 'bpm-up', text: '+', 'aria-label': 'Faster' }),
      ]),
      (() => {
        const loop = actionButton(pattern.loop ? 'Loop on' : 'Loop off', 'loop');
        loop.setAttribute('aria-pressed', String(pattern.loop));
        return loop;
      })(),
      actionButton(clearing ? 'Tap again to clear' : 'Clear', 'clear', { class: 'danger' }),
      actionButton('Save beat', 'save'),
      actionButton('Capture take', 'capture', { class: 'primary' }),
    ]);
  }

  function scoreLine() {
    return `Arrangement ${arrangementScore(pattern)}/100 · ${totalHits(pattern)} hits · ${pattern.bpm} BPM`;
  }

  function trackRow(track) {
    const state = pattern.tracks[track.id];
    const row = h('div', { class: 'seq-track', 'data-track': track.id });
    const head = h('div', { class: 'seq-head' }, [
      h('button', {
        class: 'seq-mute',
        type: 'button',
        'data-mute': track.id,
        'aria-pressed': String(state.mute),
        'aria-label': `Mute ${track.label}`,
        text: 'M',
      }),
      h('span', { class: 'seq-name', text: track.label }),
      h('span', { class: 'seq-count', 'data-count': track.id, text: `${countSteps(pattern, track.id)}` }),
    ]);
    const volume = h('input', {
      class: 'seq-vol',
      type: 'range',
      min: '0',
      max: '100',
      step: '5',
      'data-vol': track.id,
      'aria-label': `${track.label} volume`,
    });
    volume.value = String(Math.round(state.volume * 100));
    head.append(volume);

    const grid = h('div', { class: 'seq-pads' });
    const list = [];
    for (let step = 0; step < STEPS; step += 1) {
      const pad = h('button', {
        class: 'seq-pad',
        type: 'button',
        'data-pad-track': track.id,
        'data-pad-step': String(step),
        'data-beat': step % 4 === 0 ? '1' : '0',
        'aria-pressed': String(state.steps[step]),
        'aria-label': `${track.label} step ${step + 1}`,
      });
      list.push(pad);
      grid.append(pad);
    }
    pads.set(track.id, list);
    row.append(head, grid);
    return row;
  }

  function renderBeat() {
    const rows = TRACKS.map(trackRow);
    const parts = [
      renderTransport(),
      h('p', { class: 'fine', id: 'producerScore', text: scoreLine() }),
      h('p', {
        class: 'fine',
        id: 'producerAudio',
        text:
          audio.ctx?.state === 'running'
            ? 'Audio running · press Play for the loop, then Capture take to record it'
            : 'Audio not started · press Play once to unlock sound',
      }),
      ...rows,
      h('div', { class: 'producer-actions' }, [
        take
          ? actionButton(`Review last take · ${take.quality}/100${take.accepted ? ' accepted' : ' rejected'}`, 'review')
          : null,
        actionButton('Load starter beat', 'starter'),
      ]),
      h('p', {
        class: 'fine',
        text:
          variant === 'maya'
            ? 'Maya is listening from the back of the room. Same pads, same engineer: she signs a take only if the arrangement holds up.'
            : 'Pads are steps 1–16. Every fourth is marked. The engineer judges the arrangement and your timing: 80 or better is a master.',
      }),
    ];
    return parts.filter(Boolean);
  }

  function renderCapture() {
    const dots = h('div', { class: 'capture-beats', id: 'captureBeats' });
    for (let i = 0; i < 8; i += 1) dots.append(h('span', { 'data-hit': String(i < taps) }));
    return [
      h('p', { class: 'eyebrow', text: 'TAKE · PERFORM 8 BARS' }),
      h('h3', { class: 'capture-title', id: 'captureTitle', text: `Tap on the beat · ${taps}/8` }),
      dots,
      h('button', { class: 'capture-pad', type: 'button', 'data-act': 'tap', text: 'TAP' }),
      h('p', { class: 'fine', text: 'The loop is your beat. Space or Enter also works on a keyboard.' }),
      actionButton('Stop and rework', 'rework', { class: 'danger' }),
    ];
  }

  function renderCaptureProgress() {
    const title = el('captureTitle');
    if (title) title.textContent = `Tap on the beat · ${taps}/8`;
    const dots = el('captureBeats');
    if (dots) [...dots.children].forEach((dot, index) => dot.setAttribute('data-hit', String(index < taps)));
  }

  function renderReview() {
    const gate = assessMaster(pattern, take);
    const verdict = take?.burst
      ? {
          accepted: false,
          quality: 0,
          line: 'Engineer: that was a burst of taps, not a performance. Play it again in time.',
        }
      : verdictFor(take?.quality ?? 0, {
          arrangement: take?.arrangement ?? 0,
          timing: take?.timing ?? 0,
        });
    const canAccept = Boolean(take?.accepted) && gate.ready;
    const checks = gate.checks.map((check) =>
      h('li', { class: check.ok ? 'check ok' : 'check bad' }, [
        h('span', { class: 'check-mark', text: check.ok ? '✓' : '×' }),
        h('span', { text: `${check.label} · ${check.detail}` }),
      ]),
    );

    return [
      h('p', { class: 'eyebrow', text: `TAKE REVIEW · ${take?.quality >= 80 ? 'ACCEPTED' : 'REWORK'}` }),
      h('div', { class: 'score-grid' }, [
        h('div', { class: 'score-card' }, [h('b', { text: String(take?.arrangement ?? 0) }), h('small', { text: 'Arrangement' })]),
        h('div', { class: 'score-card' }, [h('b', { text: String(take?.timing ?? 0) }), h('small', { text: 'Timing' })]),
        h('div', { class: 'score-card' }, [h('b', { text: String(take?.quality ?? 0) }), h('small', { text: 'Take' })]),
      ]),
      h('p', { class: 'capture-title', text: verdict.line }),
      h('p', { class: 'field-label', text: 'Mastering gate' }),
      h('ul', { class: 'checks' }, checks),
      h('div', { class: 'producer-actions' }, [
        takeUrl
          ? h('button', { class: 'sheet-btn', type: 'button', 'data-act': 'playtake', text: 'Play back your take' })
          : null,
        actionButton('Rework the beat', 'rework'),
        (() => {
          const accept = actionButton(mastered ? 'Mastered' : 'Accept & master', 'accept', {
            class: canAccept && !mastered ? 'primary' : '',
          });
          if (!canAccept || mastered) accept.disabled = true;
          return accept;
        })(),
      ]),
      h('p', {
        class: 'fine',
        text: mastered
          ? 'Mastered. Take it to The Vault desk to hand it over.'
          : canAccept
            ? 'Accepting sets the release to mastered. Nothing is paid at this stage.'
            : 'The desk will not take this master until every gate above passes.',
      }),
    ].filter(Boolean);
  }

  function render() {
    if (sheet.classList.contains('hidden')) return;
    const content = mode === 'capture' ? renderCapture() : mode === 'review' ? renderReview() : renderBeat();
    body.replaceChildren(...[].concat(content).filter(Boolean));
    if (mode !== 'capture') pads.clear();
    if (mode === 'beat') {
      // Pads were rebuilt, so restore the playhead for the running loop.
      highlight(-1);
    }
  }

  function open(nextVariant = 'studio') {
    variant = nextVariant === 'maya' ? 'maya' : 'studio';
    const title = el('producerTitle');
    if (title) title.textContent = variant === 'maya' ? 'Maya’s B room' : 'Beat desk';
    const saved = getProduction?.() ?? {};
    pattern = normalizePattern(saved.pattern ?? createPattern());
    // Opening the desk on an empty pattern and pressing Play would be silence.
    if (totalHits(pattern) === 0) pattern = createPattern({ hits: STARTER_STEPS });
    take = saved.take ?? null;
    captures = Number(saved.captures) || 0;
    mastered = false;
    mode = 'beat';
    taps = 0;
    playing = false;
    clearing = false;
    sheet.classList.remove('hidden');
    render();
    onToast?.(
      variant === 'maya'
        ? 'Maya’s B room · she will not sign a loose take'
        : 'Studio 808 · build a beat, then cut a take',
    );
  }

  function close() {
    stopPlayback();
    if (playback) {
      playback.pause();
      playback = null;
    }
    if (recording) {
      recording = false;
      audio.stopRecording();
    }
    clearing = false;
    if (clearTimer) clearTimeout(clearTimer);
    clearTimer = null;
    sheet.classList.add('hidden');
  }

  // ---- events --------------------------------------------------------------

  body.addEventListener('click', (event) => {
    const action = event.target.closest('[data-act]')?.dataset.act;
    if (action) {
      if (action === 'play') togglePlayback();
      else if (action === 'playtake') {
        if (!takeUrl) return;
        if (!playback) playback = new Audio(takeUrl);
        playback.currentTime = 0;
        playback.play().catch(() => onToast?.('Tap again to hear the take'));
      }
      else if (action === 'capture') startCapture();
      else if (action === 'tap') tap();
      else if (action === 'rework') {
        mode = 'beat';
        render();
      } else if (action === 'review') {
        mode = 'review';
        render();
      } else if (action === 'accept') {
        const gate = assessMaster(pattern, take);
        if (!take?.accepted || !gate.ready || mastered) return;
        mastered = true;
        onMastered?.({ pattern, take, gate, variant });
        save();
        render();
      } else if (action === 'save') {
        save();
        onToast?.('Beat saved to this run');
      } else if (action === 'starter') {
        pattern = createPattern({ hits: STARTER_STEPS });
        mastered = false;
        save();
        render();
      } else if (action === 'loop') {
        setLoop(pattern, !pattern.loop);
        if (playing) audio.updateSequencerPattern(pattern);
        save();
        render();
      } else if (action === 'bpm-up' || action === 'bpm-down') {
        setBpm(pattern, pattern.bpm + (action === 'bpm-up' ? 5 : -5));
        if (playing) audio.updateSequencerPattern(pattern);
        save();
        render();
      } else if (action === 'clear') {
        if (!clearing) {
          clearing = true;
          clearTimer = setTimeout(() => {
            clearing = false;
            render();
          }, 3000);
          render();
        } else {
          if (clearTimer) clearTimeout(clearTimer);
          clearTimer = null;
          clearing = false;
          clearPattern(pattern);
          save();
          render();
          onToast?.('Pattern cleared · tempo and mix kept');
        }
      }
      return;
    }

    const pad = event.target.closest('[data-pad-track]');
    if (pad) {
      const track = pad.dataset.padTrack;
      const step = Number(pad.dataset.padStep);
      const on = toggleStep(pattern, track, step);
      pad.setAttribute('aria-pressed', String(on));
      audio.click(Boolean(on));
      const count = document.querySelector(`[data-count="${track}"]`);
      if (count) count.textContent = String(countSteps(pattern, track));
      const line = el('producerScore');
      if (line) line.textContent = scoreLine();
      persistSoon();
      return;
    }

    const mute = event.target.closest('[data-mute]');
    if (mute) {
      const track = mute.dataset.mute;
      const muted = toggleMute(pattern, track);
      mute.setAttribute('aria-pressed', String(muted));
      if (playing) audio.updateSequencerPattern(pattern);
      persistSoon();
    }
  });

  body.addEventListener('input', (event) => {
    const slider = event.target.closest('[data-vol]');
    if (!slider) return;
    setVolume(pattern, slider.dataset.vol, Number(slider.value) / 100);
    if (playing) audio.updateSequencerPattern(pattern);
    persistSoon();
  });

  closeButton.addEventListener('click', close);

  return {
    open,
    close,
    isOpen: () => !sheet.classList.contains('hidden'),
    handleKey(key) {
      if (key === 'escape') {
        close();
        return true;
      }
      if (key === ' ' || key === 'enter') {
        if (mode === 'capture') tap();
        return true;
      }
      return true;
    },
    stopPlayback,
    // Test and debug access only; the panel itself never reads these.
    debug: () => ({ pattern, take, captures, mode, playing, mastered, variant, takeUrl: Boolean(takeUrl) }),
    takeUrlForTest: () => takeUrl,
    audioState: () => audio.ctx?.state ?? 'off',
    setPatternForTest(next) {
      pattern = normalizePattern(next);
      if (playing) audio.updateSequencerPattern(pattern);
      render();
    },
    tapForTest: () => tap(),
    startCaptureForTest: () => startCapture(),
    // Test only: drop in a scored take so the accept path can be exercised
    // without waiting on a human performance.
    setTakeForTest(next) {
      take = next;
      mode = 'review';
      mastered = false;
      render();
    },
    openReview: () => {
      mode = 'review';
      render();
    },
    acceptForTest: () => {
      const gate = assessMaster(pattern, take);
      if (!take?.accepted || !gate.ready || mastered) return false;
      mastered = true;
      onMastered?.({ pattern, take, gate, variant });
      save();
      render();
      return true;
    },
    togglePlayForTest: () => togglePlayback(),
    isPlaying: () => playing,
  };
}

