// Canvas wheel script
const canvas = document.getElementById('wheelCanvas');
const ctx = canvas.getContext('2d');
const spinBtn = document.getElementById('spinBtn');
const slices = [
    'Prize 1', 'Prize 2', 'Prize 3', 'Prize 4',
    'Prize 5', 'Prize 6', 'Prize 7', 'Prize 8'
];
const colors = [
    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
    '#9966FF', '#FF9F40', '#C9CBCF', '#FF6F61'
];
const numSlices = slices.length;
const arcSize = (2 * Math.PI) / numSlices;
let angle = 0;
let spinning = false;
let spinVelocity = 0;
let spinAcceleration = 0;

// Audio variables
let audioCtx = null;
let spinOsc = null;
let spinGain = null;
let spinFilter = null;

function ensureAudioContext() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function startSpinSound() {
    ensureAudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (spinOsc) return; // already playing

    spinOsc = audioCtx.createOscillator();
    spinOsc.type = 'sawtooth';
    spinFilter = audioCtx.createBiquadFilter();
    spinFilter.type = 'lowpass';
    spinFilter.frequency.value = 800;
    spinGain = audioCtx.createGain();
    spinGain.gain.value = 0.0001;

    spinOsc.connect(spinFilter);
    spinFilter.connect(spinGain);
    spinGain.connect(audioCtx.destination);
    spinOsc.start();

    // fade in
    spinGain.gain.cancelScheduledValues(audioCtx.currentTime);
    spinGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    spinGain.gain.exponentialRampToValueAtTime(0.18, audioCtx.currentTime + 0.08);
}

function updateSpinSound() {
    if (!spinOsc || !audioCtx) return;
    // Map spinVelocity to audible frequency/filter values
    const baseFreq = 180 + Math.abs(spinVelocity) * 2000; // Hz
    const filterFreq = 600 + Math.abs(spinVelocity) * 1800;
    spinOsc.frequency.setTargetAtTime(Math.max(80, baseFreq), audioCtx.currentTime, 0.02);
    spinFilter.frequency.setTargetAtTime(Math.min(12000, filterFreq), audioCtx.currentTime, 0.02);
}

function stopSpinSound() {
    if (!spinGain || !spinOsc) return;
    const t = audioCtx.currentTime;
    spinGain.gain.cancelScheduledValues(t);
    spinGain.gain.setValueAtTime(spinGain.gain.value, t);
    spinGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    // stop and clean up after fade
    setTimeout(() => {
        try {
            if (spinOsc) spinOsc.stop();
        } catch (e) {}
        if (spinOsc) { spinOsc.disconnect(); spinOsc = null; }
        if (spinFilter) { spinFilter.disconnect(); spinFilter = null; }
        if (spinGain) { spinGain.disconnect(); spinGain = null; }
    }, 500);
}

function playWinSound() {
    ensureAudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;

    // Chime: two layered oscillators
    const o1 = audioCtx.createOscillator();
    const g1 = audioCtx.createGain();
    o1.type = 'sine';
    o1.frequency.setValueAtTime(880, now);
    g1.gain.setValueAtTime(0.0001, now);
    o1.connect(g1);
    g1.connect(audioCtx.destination);
    o1.start(now);
    g1.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
    o1.frequency.exponentialRampToValueAtTime(660, now + 0.35);
    g1.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
    o1.stop(now + 1.15);

    const o2 = audioCtx.createOscillator();
    const g2 = audioCtx.createGain();
    o2.type = 'triangle';
    o2.frequency.setValueAtTime(1320, now + 0.04);
    g2.gain.setValueAtTime(0.0001, now + 0.04);
    o2.connect(g2);
    g2.connect(audioCtx.destination);
    o2.start(now + 0.04);
    g2.gain.exponentialRampToValueAtTime(0.08, now + 0.08);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    o2.stop(now + 0.65);
}

// Result tab elements
const resultTab = document.getElementById('resultTab');
const prizeNameEl = document.getElementById('prizeName');
const spinAgainBtn = document.getElementById('spinAgainBtn');
const closeResultBtn = document.getElementById('closeResultBtn');

function showResult(prize) {
    prizeNameEl.textContent = prize;
    resultTab.classList.add('open');
    resultTab.setAttribute('aria-hidden', 'false');
}

function hideResult() {
    resultTab.classList.remove('open');
    resultTab.setAttribute('aria-hidden', 'true');
}

function drawWheel(currentAngle) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 10;
    for (let i = 0; i < numSlices; i++) {
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(
            centerX,
            centerY,
            radius,
            currentAngle + i * arcSize,
            currentAngle + (i + 1) * arcSize
        );
        ctx.closePath();
        ctx.fillStyle = colors[i % colors.length];
        ctx.fill();
        // Draw text
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(currentAngle + (i + 0.5) * arcSize);
        ctx.textAlign = 'right';
        ctx.font = '18px Arial';
        ctx.fillStyle = '#222';
        ctx.fillText(slices[i], radius - 20, 10);
        ctx.restore();
    }
    // Draw pointer (triangle pointing down into the wheel)
    ctx.save();
    ctx.beginPath();
    // base sits outside the top of the wheel, apex points down toward the center
    ctx.moveTo(centerX - 20, centerY - radius - 10);
    ctx.lineTo(centerX + 20, centerY - radius - 10);
    ctx.lineTo(centerX, centerY - radius + 20);
    ctx.closePath();
    ctx.fillStyle = '#e53935';
    ctx.fill();
    ctx.restore();
}

function animate() {
    if (!spinning) return;
    angle += spinVelocity;
    spinVelocity *= 0.985; // friction
    if (spinVelocity < 0.01) {
        spinning = false;
        spinVelocity = 0;
        // Wheel stopped — compute which slice is at the pointer and show result
        const selectedIndex = getSelectedSliceIndex();
        const prize = slices[selectedIndex];
        // stop spin sound and play win sound
        stopSpinSound();
        playWinSound();
        showResult(prize);
    }
    // update spin sound params to reflect velocity
    updateSpinSound();
    drawWheel(angle);
    requestAnimationFrame(animate);
}

// Compute which slice index is aligned with the pointer at the top
function getSelectedSliceIndex() {
    const twoPI = Math.PI * 2;
    // Normalize angle to [0, 2PI)
    const normalized = ((angle % twoPI) + twoPI) % twoPI;
    // The pointer is at the top (270 degrees == 3PI/2 in canvas coords)
    const pointerOnWheel = (3 * Math.PI / 2 - normalized + twoPI) % twoPI;
    const index = Math.floor(pointerOnWheel / arcSize) % numSlices;
    return index;
}

spinBtn.addEventListener('click', () => {
    if (spinning) return;
    hideResult();
    spinVelocity = Math.random() * 0.3 + 0.35; // random initial speed
    spinning = true;
    // start sound and animation
    startSpinSound();
    animate();
});

// Result tab button handlers
spinAgainBtn.addEventListener('click', () => {
    hideResult();
    if (!spinning) {
        spinVelocity = Math.random() * 0.3 + 0.35;
        spinning = true;
    startSpinSound();
    animate();
    }
});
closeResultBtn.addEventListener('click', hideResult);

// Initial draw
drawWheel(angle);
