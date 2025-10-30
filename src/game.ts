type Cell =
	| { type: "wall" }
	| { type: "empty" }
	| { type: "treasure" }
	| { type: "enemy" }
	| { type: "trap" }

type Player = {
	position: [number, number]
	fov: number
	state: "normal" | "attack" | "loot"
	health: number
	wealth: number
	animate: {
		from: [number, number]
		t: number
	}
}

type World = {
	grid: (Cell | null)[]
	fog: {
		opacity: number
		enemies: number
		treasures: number
		traps: number
	}[]
	width: number
	height: number
	player: Player
	bufferedInput: Input | null
	animations: {
		type: "reveal"
		postion: [number, number]
	}[]
}

type Input =
	| { type: "up" }
	| { type: "down" }
	| { type: "left" }
	| { type: "right" }
	| { type: "attack" }
	| { type: "loot" }

export function createWorld(width: number, height: number): World {
	const world: World = {
		width,
		height,
		animations: [],
		bufferedInput: null,
		grid: Array.from({ length: width * height }, () => null),
		fog: Array.from({ length: width * height }, () => ({
			opacity: 1,
			enemies: 0,
			traps: 0,
			treasures: 0,
		})),
		player: {
			position: [Math.floor(width / 2), Math.floor(height / 2)],
			fov: 3,
			state: "normal",
			health: 3,
			wealth: 0,
			animate: { from: [0, 0], t: 1 },
		},
	}

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (x == 0 || y == 0 || x == width - 1 || y == height - 1)
				world.grid[y * width + x] = { type: "wall" }
			else world.grid[y * width + x] = { type: "empty" }
		}
	}

	for (let i = 0; i < 10; i++) {
		const x = Math.floor(Math.random() * (width - 2)) + 1
		const y = Math.floor(Math.random() * (height - 2)) + 1
		world.grid[y * width + x] =
			Math.random() < 0.5 ? { type: "enemy" } : { type: "treasure" }
	}

	recomputeFog(world)
	return world
}

export function drawWorld(world: World, ctx: CanvasRenderingContext2D) {
	const { width, height } = ctx.canvas
	const CELL_SIZE = 50

	ctx.save()

	ctx.translate(
		Math.round(width / 2 - (world.width * CELL_SIZE) / 2),
		Math.round(height / 2 - (world.height * CELL_SIZE) / 2),
	)

	for (let y = 0; y < world.height; y++) {
		for (let x = 0; x < world.width; x++) {
			const cell = world.grid[y * world.width + x]
			if (!cell) continue

			ctx.save()
			switch (cell.type) {
				case "empty":
					ctx.fillStyle = "white"
					ctx.fillRect(
						x * CELL_SIZE,
						y * CELL_SIZE,
						CELL_SIZE,
						CELL_SIZE,
					)
					break
				case "wall":
					ctx.fillStyle = "black"
					ctx.fillRect(
						x * CELL_SIZE,
						y * CELL_SIZE,
						CELL_SIZE,
						CELL_SIZE,
					)
					break
				case "enemy":
					ctx.fillStyle = "white"
					ctx.fillRect(
						x * CELL_SIZE,
						y * CELL_SIZE,
						CELL_SIZE,
						CELL_SIZE,
					)
					ctx.fillStyle = "red"
					ctx.beginPath()
					ctx.arc(
						x * CELL_SIZE + CELL_SIZE / 2,
						y * CELL_SIZE + CELL_SIZE / 2,
						CELL_SIZE / 3.5,
						0,
						2 * Math.PI,
					)
					ctx.fill()
					break
				case "treasure":
					ctx.fillStyle = "white"
					ctx.fillRect(
						x * CELL_SIZE,
						y * CELL_SIZE,
						CELL_SIZE,
						CELL_SIZE,
					)
					ctx.fillStyle = "green"
					ctx.fillRect(
						x * CELL_SIZE + 10,
						y * CELL_SIZE + 10,
						CELL_SIZE - 20,
						CELL_SIZE - 20,
					)
					break
				case "trap":
					ctx.fillStyle = "white"
					ctx.fillRect(
						x * CELL_SIZE,
						y * CELL_SIZE,
						CELL_SIZE,
						CELL_SIZE,
					)
					ctx.beginPath()
					ctx.fillStyle = "orange"
					ctx.moveTo(x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + 5)
					ctx.lineTo(
						x * CELL_SIZE + CELL_SIZE - 5,
						y * CELL_SIZE + CELL_SIZE - 5,
					)
					ctx.lineTo(x * CELL_SIZE + 5, y * CELL_SIZE + CELL_SIZE - 5)
					ctx.closePath()
					ctx.fill()
					break
			}
			ctx.restore()

			ctx.save()
			const fog = world.fog[y * world.width + x]
			if (fog.opacity != 0) {
				ctx.fillStyle = "gray"
				ctx.strokeStyle = "1px solid black"
				ctx.globalAlpha = fog.opacity
				ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
				ctx.strokeRect(
					x * CELL_SIZE,
					y * CELL_SIZE,
					CELL_SIZE,
					CELL_SIZE,
				)
			} else {
				ctx.textAlign = "center"
				ctx.textBaseline = "middle"
				ctx.font = "16px sans-serif"
				if (fog.enemies > 0) {
					ctx.fillStyle = "red"
					ctx.fillText(
						fog.enemies.toString(),
						x * CELL_SIZE + CELL_SIZE / 3,
						y * CELL_SIZE + CELL_SIZE / 3,
					)
				}
				if (fog.traps > 0) {
					ctx.fillStyle = "orange"
					ctx.fillText(
						fog.traps.toString(),
						x * CELL_SIZE + (2 * CELL_SIZE) / 3,
						y * CELL_SIZE + CELL_SIZE / 3,
					)
				}
				if (fog.treasures > 0) {
					ctx.fillStyle = "green"
					ctx.fillText(
						fog.treasures.toString(),
						x * CELL_SIZE + CELL_SIZE / 3,
						y * CELL_SIZE + (2 * CELL_SIZE) / 3,
					)
				}
			}
			ctx.restore()
		}
	}

	ctx.save()
	switch (world.player.state) {
		case "normal":
			ctx.fillStyle = "black"
			break
		case "attack":
			ctx.fillStyle = "darkred"
			break
		case "loot":
			ctx.fillStyle = "darkgreen"
			break
	}
	ctx.beginPath()
	const px =
		world.player.animate.from[0] +
		world.player.animate.t *
			(world.player.position[0] - world.player.animate.from[0])
	const py =
		world.player.animate.from[1] +
		world.player.animate.t *
			(world.player.position[1] - world.player.animate.from[1])
	ctx.arc(
		px * CELL_SIZE + CELL_SIZE / 2,
		py * CELL_SIZE + CELL_SIZE / 2,
		CELL_SIZE / 3.5,
		0,
		2 * Math.PI,
	)
	ctx.fill()
	ctx.restore()

	ctx.restore()
}

export function updateWorld(world: World, delta: number, input: Input | null) {
	if (input) world.bufferedInput = input

	if (world.player.animate.t == 1 && world.bufferedInput) {
		const { position: pos } = world.player
		const newPos = [pos[0], pos[1]] as World["player"]["position"]
		switch (world.bufferedInput.type) {
			case "up":
				newPos[1]--
				break
			case "down":
				newPos[1]++
				break
			case "left":
				newPos[0]--
				break
			case "right":
				newPos[0]++
				break
			case "attack":
				if (world.player.state == "attack")
					world.player.state = "normal"
				else world.player.state = "attack"
				break
			case "loot":
				if (world.player.state == "loot") world.player.state = "normal"
				else world.player.state = "loot"
				break
		}

		const cell = world.grid[newPos[1] * world.width + newPos[0]]
		const fog = world.fog[newPos[1] * world.width + newPos[0]]
		if (cell) {
			switch (cell.type) {
				case "empty":
					world.player.position = newPos
					world.player.animate = { from: pos, t: 0 }
					break
				case "treasure":
					if (world.player.state == "loot" || fog.opacity != 1) {
						world.player.wealth++
					}
					;(cell as Cell).type = "empty"
					world.player.position = newPos
					world.player.animate = { from: pos, t: 0 }
					console.log(world.player)
					break
				case "enemy":
					if (world.player.state == "attack") {
						;(cell as Cell).type = "treasure"
					} else {
						world.player.health--
					}
					world.animations.push({ type: "reveal", postion: newPos })
					console.log(world.player)
					break
			}
		}

		if (pos[0] != newPos[0] || pos[1] != newPos[1])
			world.player.state = "normal"

		world.bufferedInput = null
	}

	const toReveal = [world.player.position]
	const checked: any[] = []
	while (toReveal.length) {
		const pos = toReveal.pop()!
		const fog = world.fog[pos[1] * world.width + pos[0]]
		if (fog.opacity == 1)
			world.animations.push({ type: "reveal", postion: pos })
		checked.push(fog)
		if (fog.enemies + fog.traps + fog.treasures != 0) continue
		for (let dx = -1; dx <= 1; dx++) {
			for (let dy = -1; dy <= 1; dy++) {
				const worldy = pos[1] + dy
				const worldx = pos[0] + dx
				if (
					Math.abs(world.player.position[0] - worldx) +
						Math.abs(world.player.position[1] - worldy) >
					world.player.fov
				)
					continue
				const fog = world.fog[worldy * world.width + worldx]
				if (
					!fog ||
					checked.includes(fog) ||
					worldx < 0 ||
					worldy < 0 ||
					worldx >= world.width ||
					worldy >= world.height
				)
					continue
				else toReveal.push([worldx, worldy])
			}
		}
	}

	world.player.animate.t = Math.min(world.player.animate.t + delta * 5, 1)
	for (let i = 0; i < world.animations.length; i++) {
		const animation = world.animations[i]
		switch (animation.type) {
			case "reveal":
				const fog =
					world.fog[
						animation.postion[1] * world.width +
							animation.postion[0]
					]
				if (fog) fog.opacity = Math.max(fog.opacity - delta * 5, 0)
				if (fog.opacity == 0) world.animations.splice(i--, 1)
				break
		}
	}

	recomputeFog(world)
}

function recomputeFog(world: World) {
	for (const fog of world.fog) {
		fog.enemies = 0
		fog.traps = 0
		fog.treasures = 0
	}
	for (let i = 0; i < world.fog.length; i++) {
		const fog = world.fog[i]!
		const x = i % world.width
		const y = Math.floor(i / world.width)
		for (let dx = -1; dx <= 1; dx++) {
			for (let dy = -1; dy <= 1; dy++) {
				if (dx == 0 && dy == 0) continue
				const cell = world.grid[(y + dy) * world.width + x + dx]
				const neighbour = world.fog[(y + dy) * world.width + x + dx]
				if (!cell || neighbour.opacity != 1) continue
				else if (cell.type == "enemy") fog.enemies++
				else if (cell.type == "treasure") fog.treasures++
				else if (cell.type == "trap") fog.traps++
			}
		}
	}
}
