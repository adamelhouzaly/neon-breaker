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
  powerUps: [],
  particles: [],
  widePaddleUntil: 0,
  screenShake: 0
};

function createPaddle() {
  return {
    width: 145,
    normalWidth: 145,
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
  return createBall(
    game.paddle.x + game.paddle.width / 2,
    game.paddle.y - 12
  );
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
      const armored = game.level >= 2 && row === 0 && column % 2 === 0;
      const explosive =
        game.level >= 2 &&
        row >= 1 &&
        row === Math.floor(rows / 2) &&
        column % 3 === 1;

      bricks.push({
        x: startX + column * (width + gap),
        y: 70 + row * (height + gap),
        width,
        height,
        color: explosive ? "#ff784d" : colors[row],
        health: armored ? 2 : 1,
        points: explosive ? 40 : armored ? 30 : 10,
        type: explosive ? "explosive" : armored ? "armored" : "normal"
      });
    }
  }

  return bricks;
}

function resetBall() {
  game.balls = [createStartingBall()];
  game.launched = false;
}

function resetGame() {
  game.score = 0;
  game.lives = 3;
  game.level = 1;
  game.paddle = createPaddle();
  game.bricks = createBricks();
  game.powerUps = [];
  game.particles = [];
  game.widePaddleUntil = 0;
  game.screenShake = 0;
  resetBall();
  updateHud();
}

function startGame() {
  resetGame();
  game.running = true;
  overlay.classList.add("hidden");
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

  if (!game.launched) {
    game.balls.forEach((ball) => {
      ball.x = game.paddle.x + game.paddle.width / 2;
      ball.y = game.paddle.y - ball.radius - 2;
    });
  }
}

function updateBalls() {
  game.balls.forEach((ball) => {
    if (ball.attached) {
      return;
    }

    ball.x += ball.dx;
    ball.y += ball.dy;

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
  });

  game.balls = game.balls.filter(
    (ball) => ball.y - ball.radius <= canvas.height
  );

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

  const speed = Math.min(11, Math.hypot(ball.dx, ball.dy) + 0.1);

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

    brick.health -= 1;
    createParticles(ball.x, ball.y, brick.color, 15);

    if (brick.health <= 0) {
      destroyBrick(index, ball);
    }

    break;
  }
}

function destroyBrick(index, ball) {
  const brick = game.bricks[index];

  game.bricks.splice(index, 1);
  game.score += brick.points;
  saveHighScore();
  updateHud();

  if (brick.type === "explosive") {
    explodeBrick(brick, ball);
  }

  if (Math.random() < 0.16) {
    createPowerUp(brick.x + brick.width / 2, brick.y + brick.height / 2);
  }

  if (game.bricks.length === 0) {
    nextLevel();
  }
}

function explodeBrick(explosiveBrick, ball) {
  game.screenShake = 12;
  createParticles(
    explosiveBrick.x + explosiveBrick.width / 2,
    explosiveBrick.y + explosiveBrick.height / 2,
    "#ff784d",
    35
  );

  for (let index = game.bricks.length - 1; index >= 0; index -= 1) {
    const brick = game.bricks[index];

    const brickCenterX = brick.x + brick.width / 2;
    const brickCenterY = brick.y + brick.height / 2;
    const explosionX = explosiveBrick.x + explosiveBrick.width / 2;
    const explosionY = explosiveBrick.y + explosiveBrick.height / 2;

    const distance = Math.hypot(
      brickCenterX - explosionX,
      brickCenterY - explosionY
    );

    if (distance < 115) {
      game.bricks.splice(index, 1);
      game.score += brick.points;
      createParticles(brickCenterX, brickCenterY, brick.color, 12);

      if (Math.random() < 0.1) {
        createPowerUp(brickCenterX, brickCenterY);
      }
    }
  }

  saveHighScore();
  updateHud();

  if (game.bricks.length === 0) {
    nextLevel();
  }
}

function createPowerUp(x, y) {
  const type = Math.random() < 0.5 ? "wide" : "multi";

  game.powerUps.push({
    x,
    y,
    width: 26,
    height: 26,
    speed: 2.4,
    type,
    color: type === "wide" ? "#65e8ff" : "#ff4fd8"
  });
}

function updatePowerUps() {
  game.powerUps.forEach((powerUp) => {
    powerUp.y += powerUp.speed;
  });

  for (let index = game.powerUps.length - 1; index >= 0; index -= 1) {
    const powerUp = game.powerUps[index];
    const paddle = game.paddle;

    const collected =
      powerUp.x + powerUp.width > paddle.x &&
      powerUp.x < paddle.x + paddle.width &&
      powerUp.y + powerUp.height > paddle.y &&
      powerUp.y < paddle.y + paddle.height;

    if (collected) {
      applyPowerUp(powerUp.type);
      game.powerUps.splice(index, 1);
      continue;
    }

    if (powerUp.y > canvas.height) {
      game.powerUps.splice(index, 1);
    }
  }
}

function applyPowerUp(type) {
  if (type === "wide") {
    game.paddle.width = 220;
    game.paddle.x = Math.min(
      game.paddle.x,
      canvas.width - game.paddle.width
    );

    game.widePaddleUntil = Date.now() + 10000;
    createParticles(
      game.paddle.x + game.paddle.width / 2,
      game.paddle.y,
      "#65e8ff",
      24
    );
  }

  if (type === "multi") {
    const activeBalls = game.balls.filter((ball) => !ball.attached);

    if (activeBalls.length > 0) {
      const originalBall = activeBalls[0];
      const speed = Math.hypot(originalBall.dx, originalBall.dy);

      game.balls.push(
        createBall(originalBall.x, originalBall.y, -speed * 0.7, -speed * 0.7),
        createBall(originalBall.x, originalBall.y, speed * 0.7, -speed * 0.7)
      );

      game.balls.forEach((ball) => {
        ball.attached = false;
      });
    }

    createParticles(
      game.paddle.x + game.paddle.width / 2,
      game.paddle.y,
      "#ff4fd8",
      28
    );
  }

  game.score += 25;
  saveHighScore();
  updateHud();
}

function updateTimedEffects() {
  if (game.widePaddleUntil && Date.now() > game.widePaddleUntil) {
    const paddleCenter = game.paddle.x + game.paddle.width / 2;

    game.paddle.width = game.paddle.normalWidth;
    game.paddle.x = Math.max(
      0,
      Math.min(canvas.width - game.paddle.width, paddleCenter - game.paddle.width / 2)
    );

    game.widePaddleUntil = 0;
  }

  if (game.screenShake > 0) {
    game.screenShake -= 1;
  }
}

function loseLife() {
  game.lives -= 1;
  updateHud();

  if (game.lives <= 0) {
    showOverlay(
      "GAME OVER",
      "Out of Lives",
      `Final score: ${game.score}`,
      "Play Again"
    );
    return;
  }

  game.paddle.width = game.paddle.normalWidth;
  game.widePaddleUntil = 0;
  resetBall();
}

function nextLevel() {
  game.level += 1;
  game.powerUps = [];
  game.bricks = createBricks();
  game.paddle.width = game.paddle.normalWidth;
  game.widePaddleUntil = 0;
  resetBall();
  updateHud();
}

function createParticles(x, y, color, amount) {
  for (let index = 0; index < amount; index += 1) {
    game.particles.push({
      x,
      y,
      dx: (Math.random() - 0.5) * 5,
      dy: (Math.random() - 0.5) * 5,
      life: 24 + Math.random() * 14,
      color
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
    ctx.shadowBlur = brick.type === "explosive" ? 20 : 13;
    ctx.fillRect(brick.x, brick.y, brick.width, brick.height);

    if (brick.type === "armored") {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(brick.x + 3, brick.y + 3, brick.width - 6, brick.height - 6);
    }

    if (brick.type === "explosive") {
      ctx.fillStyle = "#fff4cf";
      ctx.font = "18px Arial";
      ctx.textAlign = "center";
      ctx.fillText("✦", brick.x + brick.width / 2, brick.y + 20);
    }

    ctx.restore();
  });
}

function drawPowerUps() {
  game.powerUps.forEach((powerUp) => {
    ctx.save();
    ctx.fillStyle = powerUp.color;
    ctx.shadowColor = powerUp.color;
    ctx.shadowBlur = 16;
    ctx.fillRect(powerUp.x, powerUp.y, powerUp.width, powerUp.height);

    ctx.fillStyle = "#050617";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      powerUp.type === "wide" ? "W" : "M",
      powerUp.x + powerUp.width / 2,
      powerUp.y + 19
    );

    ctx.restore();
  });
}

function drawParticles() {
  game.particles.forEach((particle) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, particle.life / 38);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, 4, 4);
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
  ctx.fillText(
    "PRESS SPACE TO LAUNCH",
    canvas.width / 2,
    canvas.height - 105
  );
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const shakeX = game.screenShake
    ? (Math.random() - 0.5) * game.screenShake
    : 0;

  const shakeY = game.screenShake
    ? (Math.random() - 0.5) * game.screenShake
    : 0;

  ctx.save();
  ctx.translate(shakeX, shakeY);

  drawBricks();
  drawPowerUps();
  drawParticles();
  drawPaddle();
  drawBalls();
  drawLaunchHint();

  ctx.restore();
}

function gameLoop() {
  if (!game.running) {
    return;
  }

  movePaddle();
  updateBalls();
  updatePowerUps();
  updateParticles();
  updateTimedEffects();
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
