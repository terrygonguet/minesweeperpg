import { vec2 } from "gl-matrix"

type Cell = { type: "wall" } | { type: "empty" } | { type: "treasure" } | { type: "enemy" } | { type: "trap" }

type Player = {
	position: vec2
	fov: number
	state: "normal" | "attack" | "loot"
	health: number
	wealth: number
	speed: number
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
	animations: {
		type: "reveal"
		postion: vec2
	}[]
	input: {
		up: boolean
		down: boolean
		left: boolean
		right: boolean
		attack: boolean
		loot: boolean
	}
}

type InputKey = "up" | "down" | "left" | "right" | "attack" | "loot"
type Input = { type: "keydown"; key: InputKey } | { type: "keyup"; key: InputKey }

export function createWorld(width: number, height: number): World {
	const world: World = {
		width,
		height,
		animations: [],
		grid: Array.from({ length: width * height }, () => null),
		fog: Array.from({ length: width * height }, () => ({
			opacity: 1,
			enemies: 0,
			traps: 0,
			treasures: 0,
		})),
		player: {
			position: vec2.fromValues(width / 2, height / 2),
			fov: 2.5,
			state: "normal",
			health: 3,
			wealth: 0,
			speed: 3,
		},
		input: {
			up: false,
			down: false,
			left: false,
			right: false,
			attack: false,
			loot: false,
		},
	}

	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (x == 0 || y == 0 || x == width - 1 || y == height - 1) world.grid[y * width + x] = { type: "wall" }
			else world.grid[y * width + x] = { type: "empty" }
		}
	}

	for (let i = 0; i < 10; i++) {
		const x = Math.floor(Math.random() * (width - 2)) + 1
		const y = Math.floor(Math.random() * (height - 2)) + 1
		world.grid[y * width + x] = Math.random() < 0.5 ? { type: "enemy" } : { type: "treasure" }
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
					ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
					ctx.strokeRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
					break
				case "wall":
					ctx.fillStyle = "black"
					ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
					break
				case "enemy":
					ctx.fillStyle = "white"
					ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
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
					ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
					ctx.fillStyle = "green"
					ctx.fillRect(x * CELL_SIZE + 10, y * CELL_SIZE + 10, CELL_SIZE - 20, CELL_SIZE - 20)
					break
				case "trap":
					ctx.fillStyle = "white"
					ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
					ctx.beginPath()
					ctx.fillStyle = "orange"
					ctx.moveTo(x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + 5)
					ctx.lineTo(x * CELL_SIZE + CELL_SIZE - 5, y * CELL_SIZE + CELL_SIZE - 5)
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
				ctx.strokeRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
			} else {
				ctx.textAlign = "center"
				ctx.textBaseline = "middle"
				ctx.font = "16px sans-serif"
				if (fog.enemies > 0) {
					ctx.fillStyle = "red"
					ctx.fillText(fog.enemies.toString(), x * CELL_SIZE + CELL_SIZE / 3, y * CELL_SIZE + CELL_SIZE / 3)
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
	ctx.arc(world.player.position[0] * CELL_SIZE, world.player.position[1] * CELL_SIZE, CELL_SIZE / 3.5, 0, 2 * Math.PI)
	ctx.fill()
	ctx.restore()

	ctx.restore()
}

export function updateWorld(world: World, delta: number) {
	const movement = vec2.fromValues(+world.input.right - +world.input.left, +world.input.down - +world.input.up)
	vec2.normalize(movement, movement)
	vec2.scaleAndAdd(world.player.position, world.player.position, movement, world.player.speed * delta)
	const newPos = vec2.floor(vec2.create(), world.player.position)

	const cell = world.grid[newPos[1] * world.width + newPos[0]]
	const fog = world.fog[newPos[1] * world.width + newPos[0]]
	if (cell) {
		switch (cell.type) {
			case "empty":
				break
			case "treasure":
				if (world.player.state == "loot" || fog.opacity != 1) {
					world.player.wealth++
				}
				;(cell as Cell).type = "empty"
				world.player.state = "normal"
				console.log(world.player)
				break
			case "enemy":
				if (world.player.state == "attack") {
					;(cell as Cell).type = "treasure"
				} else {
					world.player.health--
				}
				world.animations.push({ type: "reveal", postion: newPos })
				world.player.state = "normal"
				console.log(world.player)
				break
		}
	}

	const playerCellPos = vec2.floor(vec2.create(), world.player.position)
	const playerFog = getAt(world.fog, playerCellPos, world.width)
	if (playerFog.opacity == 1) world.animations.push({ type: "reveal", postion: playerCellPos })

	const floorFOV = Math.floor(world.player.fov)
	const ceilFOV = Math.ceil(world.player.fov)
	for (let dx = -floorFOV; dx <= ceilFOV; dx++) {
		for (let dy = -floorFOV; dy <= ceilFOV; dy++) {
			if (Math.hypot(dx, dy) > world.player.fov) continue

			const pos = vec2.fromValues(playerCellPos[0] + dx, playerCellPos[1] + dy)
			if (!isInbounds(pos, world.width, world.height)) continue

			const fog = getAt(world.fog, pos, world.width)
			if (fog.opacity != 1) continue

			neighbours: for (let dx = -1; dx <= 1; dx++) {
				for (let dy = -1; dy <= 1; dy++) {
					const neighbourPos = vec2.fromValues(pos[0] + dx, pos[1] + dy)
					if (!isInbounds(neighbourPos, world.width, world.height)) continue

					const fog = getAt(world.fog, neighbourPos, world.width)
					if (fog.enemies + fog.traps + fog.treasures == 0 && fog.opacity == 0) {
						world.animations.push({ type: "reveal", postion: pos })
						break neighbours
					}
				}
			}
		}
	}

	for (let i = 0; i < world.animations.length; i++) {
		const animation = world.animations[i]
		switch (animation.type) {
			case "reveal":
				const fog = getAt(world.fog, animation.postion, world.width)
				if (fog) fog.opacity = Math.max(fog.opacity - delta * 2, 0)
				if (fog.opacity == 0) world.animations.splice(i--, 1)
				break
		}
	}

	recomputeFog(world)
}

export function handleInput(world: World, input: Input) {
	switch (input.key) {
		case "up":
			world.input.up = input.type == "keydown"
			break
		case "down":
			world.input.down = input.type == "keydown"
			break
		case "left":
			world.input.left = input.type == "keydown"
			break
		case "right":
			world.input.right = input.type == "keydown"
			break
		case "attack":
			world.input.attack = input.type == "keydown"
			if (world.input.attack) {
				if (world.player.state == "attack") world.player.state = "normal"
				else world.player.state = "attack"
			}
			break
		case "loot":
			world.input.loot = input.type == "keydown"
			if (world.input.loot) {
				if (world.player.state == "loot") world.player.state = "normal"
				else world.player.state = "loot"
			}
			break
	}
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

function getAt<T>(arr: T[], pos: vec2, stride: number): T {
	return arr[pos[1] * stride + pos[0]]
}

function isInbounds(pos: vec2, width: number, height: number): boolean {
	return pos[0] >= 0 && pos[1] >= 0 && pos[0] < width && pos[1] < height
}
