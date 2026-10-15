const test = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../js/numbers-eagle.js');

function createHarness({
    jumpSpeed = 0.5,
    getGameActive = () => false,
    getAnswered = () => false,
    platformRects = [
        { left: 0, width: 100 },
        { left: 200, width: 100 },
        { left: 300, width: 100 }
    ]
} = {}) {
    let currentTime = 0;
    const frames = [];
    const timers = [];
    const clearedTimers = new Set();
    const translations = [];
    const drawnImages = [];
    const waitingChanges = [];
    let nextRoundCalls = 0;

    const canvas = {
        width: 500,
        height: 250,
        getBoundingClientRect() { return { left: 0, width: 500 }; }
    };
    const platforms = platformRects.map((rect) => ({
        disabled: false,
        getBoundingClientRect() { return rect; }
    }));
    const context = {
        clearRect() {},
        save() {},
        translate(x, y) { translations.push([x, y]); },
        scale() {},
        drawImage(image) { drawnImages.push(image.name); },
        restore() {}
    };
    const image = (name) => ({ name, complete: true, naturalHeight: 10 });
    const images = {
        idle: image('idle'),
        flap: [image('flap-1'), image('flap-2')],
        celebrate: [image('celebrate-1'), image('celebrate-2')],
        wrong: [image('wrong-1')]
    };

    const animation = create({
        canvas,
        context,
        platforms,
        images,
        animationDelay: 50,
        jumpSpeed,
        getGameActive,
        getAnswered,
        setWaiting(value) { waitingChanges.push(value); },
        nextRound() { nextRoundCalls++; },
        now() { return currentTime; },
        requestAnimationFrame(callback) { frames.push(callback); },
        setTimeout(callback, delay) {
            const timer = { id: timers.length + 1, callback, delay };
            timers.push(timer);
            return timer.id;
        },
        clearTimeout(id) { clearedTimers.add(id); }
    });

    return {
        animation,
        canvas,
        platforms,
        frames,
        timers,
        clearedTimers,
        translations,
        drawnImages,
        waitingChanges,
        get nextRoundCalls() { return nextRoundCalls; },
        setTime(value) { currentTime = value; },
        stepFrame() {
            const callback = frames.shift();
            assert.equal(typeof callback, 'function', 'an animation frame should be queued');
            callback();
        },
        runPendingTimers() {
            for (const timer of timers) {
                if (!clearedTimers.has(timer.id)) timer.callback();
            }
        }
    };
}

test('eagle jumps to platform geometry, celebrates, then starts the next round', () => {
    const harness = createHarness({ getGameActive: () => true, getAnswered: () => true });
    harness.animation.startLoop();
    harness.animation.jumpToPlatform(2);

    harness.stepFrame();
    assert.equal(harness.translations.at(-1)[0], 300);
    assert.ok(Math.abs(harness.translations.at(-1)[1] - 159.375) < 0.001);
    assert.equal(harness.drawnImages.at(-1), 'flap-1');

    harness.stepFrame();
    assert.deepEqual(harness.translations.at(-1), [350, 238.75]);
    assert.equal(harness.drawnImages.at(-1), 'celebrate-1');
    assert.deepEqual(harness.waitingChanges, [true]);
    assert.ok(harness.platforms.every((platform) => platform.disabled));
    assert.equal(harness.timers[0].delay, 300);

    harness.runPendingTimers();
    assert.deepEqual(harness.waitingChanges, [true, false]);
    assert.equal(harness.nextRoundCalls, 1);
});

test('reset cancels a pending celebration so leaving the game cannot trigger another round', () => {
    const harness = createHarness({ jumpSpeed: 1, getGameActive: () => true, getAnswered: () => true });
    harness.animation.startLoop();
    harness.animation.jumpToPlatform(0);
    harness.stepFrame();
    assert.equal(harness.timers.length, 1);

    harness.animation.reset();
    harness.runPendingTimers();

    assert.deepEqual(harness.waitingChanges, [true, false]);
    assert.deepEqual([...harness.clearedTimers], [1]);
    assert.equal(harness.nextRoundCalls, 0);
    harness.stepFrame();
    assert.deepEqual(harness.translations.at(-1), [250, 190]);
});

test('eagle uses legacy positions when layout geometry is unavailable', () => {
    const harness = createHarness({
        jumpSpeed: 1,
        platformRects: [
            { left: 0, width: 100 },
            { left: 200, width: 0 },
            { left: 300, width: 100 }
        ]
    });
    harness.animation.startLoop();
    harness.animation.jumpToPlatform(1);
    harness.stepFrame();

    assert.deepEqual(harness.translations.at(-1), [250, 238.75]);
});

test('wrong-answer animation stops after its final sprite', () => {
    const harness = createHarness();
    harness.animation.startLoop();
    harness.animation.startAnimation('wrong');
    harness.setTime(50);
    harness.stepFrame();

    assert.equal(harness.drawnImages.at(-1), 'idle');
});
