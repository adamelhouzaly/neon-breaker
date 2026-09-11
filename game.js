const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const scoreElement = document.getElementById("score");
const livesElement = document.getElementById("lives");
const levelElement = document.getElementById("level");
const bestScoreElement = document.getElementById("best-score");
const overlay = document.getElementById("overlay");
const startButton = document.getElementById("start-button");
const restartButton = document.getElementById("restart-button");

const keys = {
  left: false,
  right: false
};

const HIGH_SCORE_KEY = "neonBreakerHighScore";

const game = {
  running: false,
  launched: false,
  score: 0,
  lives: 3,
  level: 1,
  bestScore: Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0,
  paddle: null,
  balls: [],
  bricks: [],
  particles: [],
  powerUps: [],
  lastTime: 0,
  widePaddleUntil: 0,
  shakeAmount: 0
};

function createPaddle() {
  return {
    normalWidth: 145,
    wideWidth: 220,
    width: 145,
    height: 18,
    x: canvas.width / 2 - 72.5,
    y: canvas.height - 52,
    speed: 9
  };
}

function createBall(x, y, dx = 4.5, dy = -5.4) {
  return {
    radius: 10,
    x,
    y,
    dx,
    dy,
    attached: true
  };
}

function createStartingBall() {
  return createBall(canvas.width / 2, canvas.height - 72);
}

function createBricks() {
  const rows = Math.min(5 + game.level - 1, 8);
  const columns = 10;
  const width = 72;
  const height = 26;
  const gap = 9;
  const totalWidth = columns * width + (columns - 1) * gap;
  const startX = (canvas.width - totalWidth) / 2;

  const colors = [
    "#ff4fd8",
    "#9c6bff",
    "#65e8ff",
    "#62ff9b",
    "#ffe86b",
    "#ff9765",
    "#ff6b93",
    "#79a7ff"
  ];

  const bricks = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const isArmored = game.level >= 2 && row === 0 && column % 2 === 0;

      const isExplosive =
        game.level >= 2 &&
        row >= 1 &&
        row < rows - 1 &&
        column % 4 === 1;

      bricks.push({
        x: startX + column * (width + gap),
        y: 70 + row * (height + gap),
        width,
        height,
        color: isExplosive ? "#ff6b3d" : colors[row],
        health: isArmored ? 2 : 1,
        points: isExplosive ? 40 : isArmored ? 30 : 10,
        type: isExplosive ? "explosive" : isArmored ? "armored" : "normal"
      });
    }
  }

  return bricks;
}

function resetBalls() {
  game.balls = [createStartingBall()];
  game.launched = false;
}

function resetGame() {
  game.score = 0;
  game.lives = 3;
  game.level = 1;
  game.paddle = createPaddle();
  game.bricks = createBricks();
  game.particles = [];
  game.powerUps = [];
  game.widePaddleUntil = 0;
  game.shakeAmount = 0;
  resetBalls();
  updateHud();
}

function startGame() {
  resetGame();
  game.running = true;
  overlay.classList.add("hidden");
  game.lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function restartGame() {
  startGame();
}

function launchBalls() {
  if (!game.running || game.launched) {
    return;
  }

  game.launched = true;

  game.balls.forEach((ball) => {
    ball.attached = false;
  });
}

function updateHud() {
  scoreElement.textContent = game.score;
  livesElement.textContent = game.lives;
  levelElement.textContent = game.level;
  bestScoreElement.textContent = game.bestScore;
}

function saveHighScore() {
  if (game.score > game.bestScore) {
    game.bestScore = game.score;
    localStorage.setItem(HIGH_SCORE_KEY, String(game.bestScore));
  }
}

function showOverlay(eyebrow, title, message, buttonText) {
  game.running = false;
  saveHighScore();
  updateHud();

  overlay.innerHTML = `
    <div class="overlay-card">
      <p class="eyebrow">${eyebrow}</p>
      <h2>${title}</h2>
      <p>${message}</p>
      <button id="play-again-button" class="primary-button" type="button">
        ${buttonText}
      </button>
    </div>
  `;

  overlay.classList.remove("hidden");

  document
    .getElementById("play-again-button")
    .addEventListener("click", startGame);
}

function updatePaddleSize() {
  const now = Date.now();
  const paddle = game.paddle;

  if (now < game.widePaddleUntil) {
    paddle.width = paddle.wideWidth;
  } else {
    paddle.width = paddle.normalWidth;
  }

  paddle.x = Math.max(0, Math.min(canvas.width - paddle.width, paddle.x));
}

function movePaddle() {
  if (keys.left) {
    game.paddle.x -= game.paddle.speed;
  }

  if (keys.right) {
    game.paddle.x += game.paddle.speed;
  }

  game.paddle.x = Math.max(
    0,
    Math.min(canvas.width - game.paddle.width, game.paddle.x)
  );

  if (!game.launched && game.balls[0]) {
    game.balls[0].x = game.paddle.x + game.paddle.width / 2;
    game.balls[0].y = game.paddle.y - game.balls[0].radius - 2;
  }
}

function updateBalls() {
  const remainingBalls = [];

  for (const ball of game.balls) {
    if (!ball.attached) {
      ball.x += ball.dx;
      ball.y += ball.dy;
    }

    if (ball.x - ball.radius <= 0) {
      ball.x = ball.radius;
      ball.dx *= -1;
    }

    if (ball.x + ball.radius >= canvas.width) {
      ball.x = canvas.width - ball.radius;
      ball.dx *= -1;
    }

    if (ball.y - ball.radius <= 0) {
      ball.y = ball.radius;
      ball.dy *= -1;
    }

    collideWithPaddle(ball);
    collideWithBricks(ball);

    if (ball.y - ball.radius <= canvas.height) {
      remainingBalls.push(ball);
    }
  }

  game.balls = remainingBalls;

  if (game.balls.length === 0) {
    loseLife();
  }
}

function collideWithPaddle(ball) {
  const paddle = game.paddle;

  const touchesPaddle =
    ball.dy > 0 &&
    ball.x + ball.radius > paddle.x &&
    ball.x - ball.radius < paddle.x + paddle.width &&
    ball.y + ball.radius > paddle.y &&
    ball.y - ball.radius < paddle.y + paddle.height;

  if (!touchesPaddle) {
    return;
  }

  const hitPosition =
    (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);

  const speed = Math.min(11, Math.hypot(ball.dx, ball.dy) + 0.12);

  ball.y = paddle.y - ball.radius - 1;
  ball.dx = speed * hitPosition;
  ball.dy = -Math.sqrt(Math.max(10, speed * speed - ball.dx * ball.dx));

  createParticles(ball.x, paddle.y, "#65e8ff", 10);
}

function circleHitsRectangle(ball, rectangle) {
  const closestX = Math.max(
    rectangle.x,
    Math.min(ball.x, rectangle.x + rectangle.width)
  );

  const closestY = Math.max(
    rectangle.y,
    Math.min(ball.y, rectangle.y + rectangle.height)
  );

  const distanceX = ball.x - closestX;
  const distanceY = ball.y - closestY;

  return distanceX * distanceX + distanceY * distanceY < ball.radius * ball.radius;
}

function collideWithBricks(ball) {
  for (let index = game.bricks.length - 1; index >= 0; index -= 1) {
    const brick = game.bricks[index];

    if (!circleHitsRectangle(ball, brick)) {
      continue;
    }

    const previousX = ball.x - ball.dx;
    const hitFromSide =
      previousX + ball.radius <= brick.x ||
      previousX - ball.radius >= brick.x + brick.width;

    if (hitFromSide) {
      ball.dx *= -1;
    } else {
      ball.dy *= -1;
    }

    damageBrick(index, ball.x, ball.y);

    if (game.bricks.length === 0) {
      nextLevel();
    }

    break;
  }
}

function damageBrick(index, hitX, hitY) {
  const brick = game.bricks[index];

  if (!brick) {
    return;
  }

  brick.health -= 1;
  createParticles(hitX, hitY, brick.color, 14);

  if (brick.health > 0) {
    game.shakeAmount = 2;
    return;
  }

  game.bricks.splice(index, 1);
  game.score += brick.points;
  game.shakeAmount = brick.type === "explosive" ? 9 : 3;

  if (brick.type === "explosive") {
    explodeBrick(brick);
  } else {
    maybeDropPowerUp(brick);
  }

  saveHighScore();
  updateHud();
}

function explodeBrick(explosiveBrick) {
  createParticles(
    explosiveBrick.x + explosiveBrick.width / 2,
    explosiveBrick.y + explosiveBrick.height / 2,
    "#ff6b3d",
    44
  );

  const blastCenterX = explosiveBrick.x + explosiveBrick.width / 2;
  const blastCenterY = explosiveBrick.y + explosiveBrick.height / 2;
  const blastRadius = 125;

  for (let index = game.bricks.length - 1; index >= 0; index -= 1) {
    const brick = game.bricks[index];
    const brickCenterX = brick.x + brick.width / 2;
    const brickCenterY = brick.y + brick.height / 2;

    const distance = Math.hypot(
      brickCenterX - blastCenterX,
      brickCenterY - blastCenterY
    );

    if (distance < blastRadius) {
      game.bricks.splice(index, 1);
      game.score += brick.points;
      createParticles(brickCenterX, brickCenterY, brick.color, 18);
      maybeDropPowerUp(brick);
    }
  }

  saveHighScore();
  updateHud();
}

function maybeDropPowerUp(brick) {
  const dropChance = 0.17;

  if (Math.random() > dropChance) {
    return;
  }

  const type = Math.random() < 0.5 ? "wide" : "multiball";

  game.powerUps.push({
    x: brick.x + brick.width / 2 - 15,
    y: brick.y,
    width: 30,
    height: 18,
    speed: 2.4,
    type
  });
}

function updatePowerUps() {
  const remainingPowerUps = [];

  for (const powerUp of game.powerUps) {
    powerUp.y += powerUp.speed;

    const touchesPaddle =
      powerUp.x + powerUp.width > game.paddle.x &&
      powerUp.x < game.paddle.x + game.paddle.width &&
      powerUp.y + powerUp.height > game.paddle.y &&
      powerUp.y < game.paddle.y + game.paddle.height;

    if (touchesPaddle) {
      applyPowerUp(powerUp.type);
      continue;
    }

    if (powerUp.y < canvas.height) {
      remainingPowerUps.push(powerUp);
    }
  }

  game.powerUps = remainingPowerUps;
}

function applyPowerUp(type) {
  if (type === "wide") {
    game.widePaddleUntil = Date.now() + 10000;
    createParticles(
      game.paddle.x + game.paddle.width / 2,
      game.paddle.y,
      "#65e8ff",
      24
    );
  }

  if (type === "multiball" && game.balls.length > 0) {
    const originalBall = game.balls[0];

    game.balls.push(
      createBall(
        originalBall.x,
        originalBall.y,
        originalBall.dx + 2.4,
        -Math.abs(originalBall.dy)
      ),
      createBall(
        originalBall.x,
        originalBall.y,
        originalBall.dx - 2.4,
        -Math.abs(originalBall.dy)
      )
    );

    game.balls.forEach((ball) => {
      ball.attached = false;
    });

    createParticles(originalBall.x, originalBall.y, "#ff4fd8", 30);
  }

  game.shakeAmount = 6;
}

function loseLife() {
  game.lives -= 1;
  updateHud();

  if (game.lives <= 0) {
    showOverlay(
      "GAME OVER",
      "Core Overloaded",
      `Final score: ${game.score}`,
      "Play Again"
    );
    return;
  }

  resetBalls();
}

function nextLevel() {
  game.level += 1;
  game.bricks = createBricks();
  game.powerUps = [];
  resetBalls();
  updateHud();
}

function createParticles(x, y, color, amount) {
  for (let index = 0; index < amount; index += 1) {
    game.particles.push({
      x,
      y,
      dx: (Math.random() - 0.5) * 5.5,
      dy: (Math.random() - 0.5) * 5.5,
      life: 24 + Math.random() * 16,
      color,
      size: 2 + Math.random() * 3
    });
  }
}

function updateParticles() {
  game.particles.forEach((particle) => {
    particle.x += particle.dx;
    particle.y += particle.dy;
    particle.life -= 1;
  });

  game.particles = game.particles.filter((particle) => particle.life > 0);

  game.shakeAmount *= 0.85;

  if (game.shakeAmount < 0.3) {
    game.shakeAmount = 0;
  }
}

function drawPaddle() {
  const paddle = game.paddle;

  const gradient = ctx.createLinearGradient(
    paddle.x,
    paddle.y,
    paddle.x + paddle.width,
    paddle.y
  );

  gradient.addColorStop(0, "#9c6bff");
  gradient.addColorStop(0.5, "#65e8ff");
  gradient.addColorStop(1, "#ff4fd8");

  ctx.save();
  ctx.fillStyle = gradient;
  ctx.shadowColor = "#65e8ff";
  ctx.shadowBlur = 18;
  ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
  ctx.restore();
}

function drawBalls() {
  game.balls.forEach((ball) => {
    ctx.save();
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#65e8ff";
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawBricks() {
  game.bricks.forEach((brick) => {
    ctx.save();
    ctx.fillStyle = brick.color;
    ctx.shadowColor = brick.color;
    ctx.shadowBlur = 13;
    ctx.fillRect(brick.x, brick.y, brick.width, brick.height);

    if (brick.type === "armored") {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(brick.x + 3, brick.y + 3, brick.width - 6, brick.height - 6);
    }

    if (brick.type === "explosive") {
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px Arial";
      ctx.textAlign = "center";
      ctx.fillText("✦", brick.x + brick.width / 2, brick.y + 19);
    }

    ctx.restore();
  });
}

function drawPowerUps() {
  game.powerUps.forEach((powerUp) => {
    const color = powerUp.type === "wide" ? "#65e8ff" : "#ff4fd8";
    const label = powerUp.type === "wide" ? "W" : "M";

    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fillRect(powerUp.x, powerUp.y, powerUp.width, powerUp.height);

    ctx.fillStyle = "#050617";
    ctx.font = "bold 13px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      label,
      powerUp.x + powerUp.width / 2,
      powerUp.y + powerUp.height - 4
    );

    ctx.restore();
  });
}

function drawParticles() {
  game.particles.forEach((particle) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, particle.life / 40);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    ctx.restore();
  });
}

function drawLaunchHint() {
  if (game.launched) {
    return;
  }

  ctx.save();
  ctx.fillStyle = "#ffe86b";
  ctx.font = "16px Space Mono";
  ctx.textAlign = "center";
  ctx.fillText("PRESS SPACE TO LAUNCH", canvas.width / 2, canvas.height - 105);
  ctx.restore();
}

function drawPowerUpTimer() {
  const secondsLeft = Math.ceil((game.widePaddleUntil - Date.now()) / 1000);

  if (secondsLeft <= 0) {
    return;
  }

  ctx.save();
  ctx.fillStyle = "#65e8ff";
  ctx.font = "14px Space Mono";
  ctx.textAlign = "left";
  ctx.fillText(`WIDE PADDLE: ${secondsLeft}s`, 22, canvas.height - 22);
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const shakeX = (Math.random() - 0.5) * game.shakeAmount;
  const shakeY = (Math.random() - 0.5) * game.shakeAmount;

  ctx.save();
  ctx.translate(shakeX, shakeY);

  drawBricks();
  drawPowerUps();
  drawParticles();
  drawPaddle();
  drawBalls();
  drawLaunchHint();
  drawPowerUpTimer();

  ctx.restore();
}

function gameLoop(timestamp) {
  if (!game.running) {
    return;
  }

  game.lastTime = timestamp;

  updatePaddleSize();
  movePaddle();
  updateBalls();
  updatePowerUps();
  updateParticles();
  draw();

  requestAnimationFrame(gameLoop);
}

function setKey(event, isPressed) {
  const key = event.key.toLowerCase();

  if (["arrowleft", "arrowright", "a", "d", " "].includes(key)) {
    event.preventDefault();
  }

  if (key === "arrowleft" || key === "a") {
    keys.left = isPressed;
  }

  if (key === "arrowright" || key === "d") {
    keys.right = isPressed;
  }

  if (key === " " && isPressed) {
    launchBalls();
  }
}

function addHoldButton(buttonId, direction) {
  const button = document.getElementById(buttonId);

  const press = (event) => {
    event.preventDefault();
    keys[direction] = true;
  };

  const release = (event) => {
    event.preventDefault();
    keys[direction] = false;
  };

  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointerleave", release);
  button.addEventListener("pointercancel", release);
}

document.addEventListener("keydown", (event) => setKey(event, true));
document.addEventListener("keyup", (event) => setKey(event, false));

addHoldButton("left-button", "left");
addHoldButton("right-button", "right");

document
  .getElementById("launch-button")
  .addEventListener("click", launchBalls);

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", restartGame);

resetGame();
draw();
