// Canvas animation controller for the Numbers game eagle.

(function (root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        root.EnglishNextLevelNumbersEagle = api;
    }
})(typeof window !== 'undefined' ? window : globalThis, () => {
    const HOME_Y_RATIO = 0.76;
    const LANDING_Y_RATIO = 0.955;
    const JUMP_HEIGHT_RATIO = 0.22;
    const PLATFORM_POSITIONS = [100, 250, 400];

    function create(dependencies = {}) {
        const canvas = dependencies.canvas || null;
        const context = dependencies.context || null;
        const platforms = dependencies.platforms || [];
        const images = dependencies.images || { idle: null, flap: [], celebrate: [], wrong: [] };
        const animationDelay = dependencies.animationDelay ?? 50;
        const jumpSpeed = dependencies.jumpSpeed ?? 0.015;
        const getGameActive = dependencies.getGameActive || (() => false);
        const getAnswered = dependencies.getAnswered || (() => false);
        const setWaiting = dependencies.setWaiting || (() => {});
        const nextRound = dependencies.nextRound || (() => {});
        const debug = dependencies.debug || (() => {});
        const now = dependencies.now || (() => Date.now());
        const scheduleFrame = dependencies.requestAnimationFrame ||
            ((callback) => globalThis.requestAnimationFrame(callback));
        const scheduleTimeout = dependencies.setTimeout ||
            ((callback, delay) => globalThis.setTimeout(callback, delay));
        const cancelTimeout = dependencies.clearTimeout ||
            ((timer) => globalThis.clearTimeout(timer));

        let x = 250;
        let y = 190;
        let startX = 250;
        let startY = 190;
        let targetX = 250;
        let targetY = 239;
        let isJumping = false;
        let jumpProgress = 0;
        let direction = -1;
        let currentAnimation = 'idle';
        let animationFrame = 0;
        let isAnimating = false;
        let lastAnimationFrame = 0;
        let loopStarted = false;
        let celebrationTimer = null;

        function easeInOutCubic(value) {
            return value < 0.5
                ? 4 * value * value * value
                : 1 - Math.pow(-2 * value + 2, 3) / 2;
        }

        function getHomePosition() {
            const width = canvas?.width || 500;
            const height = canvas?.height || 250;
            return { x: width / 2, y: height * HOME_Y_RATIO };
        }

        function getPlatformTarget(index) {
            const platform = platforms[index];
            if (!canvas || !platform) {
                return {
                    x: PLATFORM_POSITIONS[index] ?? 250,
                    y: (canvas?.height || 250) * LANDING_Y_RATIO
                };
            }

            const canvasRect = canvas.getBoundingClientRect();
            const platformRect = platform.getBoundingClientRect();

            // Hidden game screens can report zero-width layout boxes briefly.
            if (canvasRect.width <= 0 || platformRect.width <= 0) {
                return {
                    x: PLATFORM_POSITIONS[index] ?? 250,
                    y: canvas.height * LANDING_Y_RATIO
                };
            }

            const platformCenterViewportX = platformRect.left + platformRect.width / 2;
            const relativeCssX = platformCenterViewportX - canvasRect.left;
            const canvasX = relativeCssX * (canvas.width / canvasRect.width);

            return {
                x: Math.max(0, Math.min(canvas.width, canvasX)),
                // The eagle's feet land just inside the canvas above the answer card.
                y: canvas.height * LANDING_Y_RATIO
            };
        }

        function startAnimation(type) {
            debug('🎬 Starting animation:', type, 'frame:', animationFrame);
            currentAnimation = type;
            animationFrame = 0;
            isAnimating = true;
            lastAnimationFrame = now();
        }

        function stopAnimation() {
            currentAnimation = 'idle';
            animationFrame = 0;
            isAnimating = false;
        }

        function clearCelebrationTimer() {
            if (celebrationTimer === null) return;
            cancelTimeout(celebrationTimer);
            celebrationTimer = null;
        }

        function updateMovement() {
            const currentTime = now();

            if (isJumping) {
                jumpProgress = Math.min(1, jumpProgress + jumpSpeed);
                const eased = easeInOutCubic(jumpProgress);
                const canvasHeight = canvas?.height || 250;
                const jumpHeight = canvasHeight * JUMP_HEIGHT_RATIO;
                const baseX = startX + (targetX - startX) * eased;
                const baseY = startY + (targetY - startY) * eased;

                x = baseX;
                y = baseY - jumpHeight * Math.sin(jumpProgress * Math.PI);

                if (!isAnimating || currentAnimation !== 'flap') {
                    startAnimation('flap');
                }

                if (jumpProgress >= 1) {
                    x = targetX;
                    y = targetY;
                    isJumping = false;
                    jumpProgress = 0;

                    if (getGameActive() && getAnswered()) {
                        setWaiting(true);
                        platforms.forEach((platform) => { platform.disabled = true; });
                        startAnimation('celebrate');
                        clearCelebrationTimer();
                        celebrationTimer = scheduleTimeout(() => {
                            celebrationTimer = null;
                            stopAnimation();
                            setWaiting(false);
                            nextRound();
                        }, 300);
                    }
                }
            }

            if (currentTime - lastAnimationFrame >= animationDelay) {
                lastAnimationFrame = currentTime;

                if (isAnimating) {
                    animationFrame++;

                    if (currentAnimation === 'flap') {
                        if (animationFrame >= images.flap.length) animationFrame = 0;
                    } else if (currentAnimation === 'celebrate') {
                        if (animationFrame >= images.celebrate.length) {
                            animationFrame = Math.max(0, images.celebrate.length - 1);
                        }
                    } else if (currentAnimation === 'wrong') {
                        if (animationFrame >= images.wrong.length) stopAnimation();
                    }
                }
            }
        }

        function draw() {
            if (!context) return;

            context.clearRect(0, 0, canvas?.width || 500, canvas?.height || 250);

            let image = images.idle;
            if (currentAnimation === 'flap' && images.flap[animationFrame]) image = images.flap[animationFrame];
            else if (currentAnimation === 'celebrate' && images.celebrate[animationFrame]) image = images.celebrate[animationFrame];
            else if (currentAnimation === 'wrong' && images.wrong[animationFrame]) image = images.wrong[animationFrame];

            if (image && image.complete && image.naturalHeight > 0) {
                context.save();
                context.translate(x, y);
                if (direction === 1) context.scale(-1, 1);
                context.scale(1.2, 1);

                const size = currentAnimation === 'flap' ? 165 : 150;
                context.drawImage(image, -size / 2, -size, size, size);
                context.restore();
            }
        }

        function animate() {
            scheduleFrame(animate);
            updateMovement();
            draw();
        }

        function startLoop() {
            if (loopStarted) return;
            loopStarted = true;
            animate();
        }

        function jumpToPlatform(index) {
            const target = getPlatformTarget(index);
            startX = x;
            startY = y;
            targetX = target.x;
            targetY = target.y;
            isJumping = true;
            jumpProgress = 0;

            if (Math.abs(targetX - startX) < 1) {
                // A center answer still gets a real vertical jump.
                direction = -1;
            } else {
                direction = targetX > startX ? 1 : -1;
            }

            startAnimation('flap');
        }

        function reset() {
            clearCelebrationTimer();
            const home = getHomePosition();
            x = home.x;
            y = home.y;
            startX = home.x;
            startY = home.y;
            targetX = home.x;
            targetY = (canvas?.height || 250) * LANDING_Y_RATIO;
            isJumping = false;
            jumpProgress = 0;
            currentAnimation = 'idle';
            animationFrame = 0;
            isAnimating = false;
            direction = -1;
            setWaiting(false);
        }

        return Object.freeze({
            jumpToPlatform,
            reset,
            startAnimation,
            startLoop,
            stopAnimation
        });
    }

    return Object.freeze({ create });
});
