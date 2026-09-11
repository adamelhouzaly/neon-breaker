const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const scoreElement = document.getElementById("score");
const livesElement = document.getElementById("lives");
const levelElement = document.getElementById("level");
const bestScoreElement = document.getElementById("best-score");
const overlay = document.getElementById("overlay");
const startButton = document.getElementById("start-button");
const restartButton = document.getElementById("restart-button");

const keys = { left: false, right: false };
const HIGH_SCORE_KEY = "neonBreakerHighScore";

const game = {
  running: false,
  launched: false,
  score: 0,
  lives: 3,
  level: 1,
  bestScore: Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0,
  paddle: null,
  ball: null,
  bricks: [],
  particles: [],
  lastTime: 0
};

function createPaddle() {
  return {
    width: 145,
    height: 18,
    x: canvas.width / 2 - 72.5,
    y: canvas.height - 52,
    speed: 9
  };
}

function createBall() {
  return {
    radius: 10,
    x: canvas.width / 2,
    y: canvas.height - 72,
    dx: 4.5,
    dy: -5.4,
    attached: true
  };
}

function createBricks() {
  const rows = Math.min(5 + game.level - 1, 8);
  const columns = 10;
  const width = 72;
  const height = 26;
  const gap = 9;
  const totalWidth = columns * width + (columns - 1) * gap;
  const startX = (canvas.width - totalWidth) / 2;
  const colors = ["#ff4fd8", "#9c6bff", "#65e8ff", "#62ff9b", "#ffe86b", "#ff9765", "#ff6b93", "#79a7ff"];
  const bricks = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const strongBrick = game.level >= 2 && row === 0 && column % 2 === 0;
      bricks.push({
        x: startX + column * (width + gap),
        y: 70 + row * (height + gap),
        width,
        height,
        color: colors[row],
        health: strongBrick ? 2 : 1,
        points: strongBrick ? 30 : 10
      });
    }
  }

  return bricks;
}

function resetBall() {
  game.ball = createBall();
  game.launched = false;
}

function resetGame() {
  game.score = 0;
  game.lives = 3;
  game.level = 1;
  game.paddle = createPaddle();
  game.bricks = createBricks();
  game.particles = [];
  resetBall();
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

function launchBall() {
  if (game.running && !game.launched) {
    game.launched = true;
    game.ball.attached = false;
  }
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
      <button id="play-again-button" class="primary-button" type="button">${buttonText}</button>
    </div>
  `;

  overlay.classList.remove("hidden");
  document.getElementById("play-again-button").addEventListener("click", startGame);
}

function movePaddle() {
  if (keys.left) game.paddle.x -= game.paddle.speed;
  if (keys.right) game.paddle.x += game.paddle.speed;

  game.paddle.x = Math.max(0, Math.min(canvas.width - game.paddle.width, game.paddle.x));

  if (!game.launched) {
    game.ball.x = game.paddle.x + game.paddle.width / 2;
    game.ball.y = game.paddle.y - game.ball.radius - 2;
  }
}

function updateBall() {
  if (!game.launched) return;

  const ball = game.ball;
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

  if (ball.y - ball.radius > canvas.height) {
    loseLife();
    return;
  }

  collideWithPaddle();
  collideWithBricks();
}

function collideWithPaddle() {
  const ball = game.ball;
  const paddle = game.paddle;
  const touchesPaddle =
    ball.dy > 0 &&
    ball.x + ball.radius > paddle.x &&
    ball.x - ball.radius < paddle.x + paddle.width &&
    ball.y + ball.radius > paddle.y &&
    ball.y - ball.radius < paddle.y + paddle.height;

  if (!touchesPaddle) return;

  const hitPosition = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
  const speed = Math.min(10.5, Math.hypot(ball.dx, ball.dy) + 0.12);

  ball.y = paddle.y - ball.radius - 1;
  ball.dx = speed * hitPosition;
  ball.dy = -Math.sqrt(Math.max(10, speed * speed - ball.dx * ball.dx));

  createParticles(ball.x, paddle.y, "#65e8ff", 10);
}

function circleHitsRectangle(ball, rectangle) {
  const closestX = Math.max(rectangle.x, Math.min(ball.x, rectangle.x + rectangle.width));
  const closestY = Math.max(rectangle.y, Math.min(ball.y, rectangle.y + rectangle.height));
  const distanceX = ball.x - closestX;
  const distanceY = ball.y - closestY;
  return distanceX * distanceX + distanceY * distanceY < ball.radius * ball.radius;
}

function collideWithBricks() {
  const ball = game.ball;

  for (let index = game.bricks.length - 1; index >= 0; index -= 1) {
    const brick = game.bricks[index];

    if (!circleHitsRectangle(ball, brick)) continue;

    const previousX = ball.x - ball.dx;
    const previousY = ball.y - ball.dy;
    const hitFromSide = previousX + ball.radius <= brick.x || previousX - ball.radius >= brick.x + brick.width;

    if (hitFromSide) {
      ball.dx *= -1;
    } else {
      ball.dy *= -1;
    }

    brick.health -= 1;
    createParticles(ball.x, ball.y, brick.color, 14);

    if (brick.health <= 0) {
      game.bricks.splice(index, 1);
      game.score += brick.points;
      saveHighScore();
      updateHud();
    }

    if (game.bricks.length === 0) {
      nextLevel();
    }

    break;
  }
}

function loseLife() {
  game.lives -= 1;
  updateHud();

  if (game.lives <= 0) {
    showOverlay("GAME OVER", "Out of Lives", `Final score: ${game.score}`, "Play Again");
    return;
  }

  resetBall();
}

function nextLevel() {
  game.level += 1;
  game.bricks = createBricks();
  resetBall();
  updateHud();
}

function createParticles(x, y, color, amount) {
  for (let i = 0; i < amount; i += 1) {
    game.particles.push({
      x,
      y,
      dx: (Math.random() - 0.5) * 5,
      dy: (Math.random() - 0.5) * 5,
      life: 24 + Math.random() * 12,
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
  const gradient = ctx.createLinearGradient(paddle.x, paddle.y, paddle.x + paddle.width, paddle.y);
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

function drawBall() {
  const ball = game.ball;
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "#65e8ff";
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBricks() {
  game.bricks.forEach((brick) => {
    ctx.save();
    ctx.fillStyle = brick.color;
    ctx.shadowColor = brick.color;
    ctx.shadowBlur = 13;
    ctx.fillRect(brick.x, brick.y, brick.width, brick.height);

    if (brick.health === 2) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(brick.x + 3, brick.y + 3, brick.width - 6, brick.height - 6);
    }

    ctx.restore();
  });
}

function drawParticles() {
  game.particles.forEach((particle) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, particle.life / 36);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, 4, 4);
    ctx.restore();
  });
}

function drawLaunchHint() {
  if (game.launched) return;

  ctx.save();
  ctx.fillStyle = "#ffe86b";
  ctx.font = "16px Space Mono";
  ctx.textAlign = "center";
  ctx.fillText("PRESS SPACE TO LAUNCH", canvas.width / 2, canvas.height - 105);
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBricks();
  drawParticles();
  drawPaddle();
  drawBall();
  drawLaunchHint();
}

function gameLoop(timestamp) {
  if (!game.running) return;

  game.lastTime = timestamp;
  movePaddle();
  updateBall();
  updateParticles();
  draw();
  requestAnimationFrame(gameLoop);
}

function setKey(event, isPressed) {
  const key = event.key.toLowerCase();

  if (["arrowleft", "arrowright", "a", "d", " "].includes(key)) {
    event.preventDefault();
  }

  if (key === "arrowleft" || key === "a") keys.left = isPressed;
  if (key === "arrowright" || key === "d") keys.right = isPressed;
  if (key === " " && isPressed) launchBall();
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
document.getElementById("launch-button").addEventListener("click", launchBall);
startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", restartGame);

resetGame();
draw();
